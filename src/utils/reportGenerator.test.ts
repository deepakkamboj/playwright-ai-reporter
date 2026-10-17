import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, beforeEach, test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {assertStandaloneReport, ReportGenerator} from './reportGenerator';

let directory: string;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'report-gen-'));
});

afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
});

const write = (name: string, content: string | Buffer): void => {
    fs.mkdirSync(path.dirname(path.join(directory, name)), {recursive: true});
    fs.writeFileSync(path.join(directory, name), content);
};

const html = (): string => fs.readFileSync(path.join(directory, 'test-health-report.html'), 'utf8');

const withData = (errorMessage: string, screenshot: string): void => {
    const testCase = {
        testId: 't1',
        testTitle: 'a test',
        suiteTitle: 's',
        outcome: 'unexpected',
        artifacts: {screenshot: {href: screenshot, path: screenshot}},
    };
    write('testSummary.json', JSON.stringify({allTestCases: [testCase], testCount: 1}));
    write('testFailures.json', JSON.stringify({failures: [{...testCase, errorMessage}]}));
};

test('the report is one file: the code and the data are inside it', () => {
    withData('boom', 'shot.png');
    new ReportGenerator(directory).generateReport();

    const out = html();
    assert.doesNotMatch(out, /src="test-health-report\.js"/);
    assert.doesNotMatch(out, /href="test-health-report\.css"/);
    assert.match(out, /<style(?:\s|>)/);
    assert.match(out, /document\.addEventListener\('DOMContentLoaded', init\)/);
    assert.match(out, /window\.EMBEDDED_TEST_SUMMARY = \{/);
    assert.doesNotMatch(out, /https?:\/\/cdn/);
});

test('standalone validation rejects missing or external assets', () => {
    const data = '<script>window.EMBEDDED_TEST_SUMMARY = {}; window.EMBEDDED_TEST_FAILURES = [];</script>';
    assert.throws(() => assertStandaloneReport(data), /embedded CSS/);
    assert.throws(
        () => assertStandaloneReport(`<style></style>${data}<script src="report.js"></script><script></script>`),
        /external JavaScript/,
    );
    assert.throws(
        () =>
            assertStandaloneReport(`<link href="report.css"><style></style>${data}<script></script><script></script>`),
        /external stylesheet/,
    );
});

test('an error that contains a closing script tag cannot break out of the embedded data', () => {
    withData('</script><script>alert(1)</script>', 'shot.png');
    new ReportGenerator(directory).generateReport();

    assert.doesNotMatch(html(), /<\/script><script>alert/);
});

test('embedded report data is redacted even when input JSON was not', () => {
    const secret = 'report-secret-123456789';
    withData(`password=${secret}; repeated ${secret}`, 'shot.png');
    new ReportGenerator(directory).generateReport();

    assert.doesNotMatch(html(), new RegExp(secret));
    assert.match(html(), /\*\*\*\*/);
});

test('small screenshots are embedded so the file still shows them when moved alone', () => {
    write('shot.png', Buffer.from('png-bytes'));
    withData('boom', 'shot.png');
    new ReportGenerator(directory).generateReport();

    assert.match(html(), /data:image\/png;base64,/);
});

test('screenshots that are too large stay plain links', () => {
    write('big.png', Buffer.alloc(700 * 1024, 1));
    withData('boom', 'big.png');
    new ReportGenerator(directory).generateReport();

    assert.doesNotMatch(html(), /data:image\/png;base64,/);
});

test('inlined code is not corrupted by "$" replacement patterns', () => {
    withData("cost is $& and $' and $`", 'shot.png');
    new ReportGenerator(directory).generateReport();

    assert.match(html(), /function esc\(value\)/);
});

const reportClient = fs.readFileSync(path.join(__dirname, '..', 'templates', 'test-health-report.js'), 'utf8');

function renderClient(
    expression: string,
    cases: object[] = [],
    trend: object[] = [],
    extraSummary: object = {},
): string {
    return runInNewContext(
        `${reportClient}\nsummary = input; failureData = {failures: input.failures || []}; processData();\n${expression}`,
        {
            document: {addEventListener: () => undefined},
            input: {allTestCases: cases, trend, ...extraSummary},
        },
    );
}

const reportCase = (id: string, outcome: string, extra: object = {}): object => ({
    testId: id,
    testTitle: `Test ${id}`,
    suiteTitle: 'sample',
    outcome,
    ...extra,
});

test('the standalone shell uses the Test Health Report name and native section navigation', () => {
    withData('boom', 'shot.png');
    new ReportGenerator(directory).generateReport();
    const output = html();
    assert.match(output, /<title>Test Health Report<\/title>/);
    assert.match(output, /class="skip-link" href="#reportContent"/);
    for (const section of ['overview', 'tests', 'failures', 'api', 'timeline', 'ai-fixes', 'settings']) {
        assert.match(output, new RegExp(`class="tab" href="#${section}" data-tab="${section}"`));
    }
    assert.match(output, /<header class="report-navigation">/);
    assert.match(output, /<footer class="page-foot">\s*<p>Evidence first\. Investigate, then act\.<\/p>/);
    assert.doesNotMatch(
        output,
        /role="tablist"|role="tabpanel"|id="runPills"|id="statusStrip"|class="workspace-nav"|id="countTests"|id="countApi"|class="nav-index"/,
    );
});

test('the run brief counts retries separately and measures only executed tests', () => {
    const output = renderClient('runBrief()', [
        reportCase('pass', 'expected'),
        reportCase('fail', 'unexpected'),
        reportCase('retry', 'flaky'),
        reportCase('skip', 'skipped'),
    ]);
    assert.match(output, /1 failing test to investigate/);
    assert.match(output, /33%/);
    assert.match(output, /1 of 3 executed tests passed without retries/);
    assert.match(output, /href="#failures"/);
    assert.match(output, /aria-label="Test outcomes"/);
    for (const status of ['passed', 'failed', 'flaky', 'skipped']) {
        assert.match(output, new RegExp(`class="outcome-tile outcome-${status}"`));
    }
    const tiles = output.match(/<dl class="outcome-tiles"[\s\S]*?<\/dl>/)?.[0] || '';
    assert.equal((tiles.match(/focusable="false"/g) || []).length, 5);
    assert.ok(tiles.indexOf('Total tests') < tiles.indexOf('Passed'));
    assert.doesNotMatch(output, /class="stat|class="donut/);
});

test('empty and skipped-only runs never claim success or a measured pass rate', () => {
    for (const cases of [[], [reportCase('skip', 'skipped')]]) {
        const output = renderClient('runBrief() + attentionPanel()', cases);
        assert.match(output, /No test results recorded|did not execute any tests/);
        assert.match(output, /No executed tests to measure/);
        assert.doesNotMatch(output, /Executed tests are clear|Every test passed|NaN|Infinity|0%/);
    }
});

test('the run brief distinguishes stable and retry-recovered runs and retains trend comparison', () => {
    assert.match(renderClient('runBrief()', [reportCase('pass', 'expected')]), /Executed tests are clear/);
    assert.match(renderClient('runBrief()', [reportCase('retry', 'flaky')]), /Retries recovered the run/);
    const trend = [
        {passed: 1, failed: 1, flaky: 0},
        {passed: 1, failed: 0, flaky: 0},
    ];
    assert.match(renderClient('runBrief()', [reportCase('pass', 'expected')], trend), /Up 50 pts/);
});

test('the execution register orders timestamped tests and escapes names while preserving evidence actions', () => {
    const cases = [
        reportCase('later', 'expected', {
            attempts: [{status: 'passed', durationMs: 2000, startTime: '2026-10-17T10:01:00Z'}],
        }),
        reportCase('early', 'unexpected', {
            testTitle: '<img src=x onerror=alert(1)>',
            attempts: [{status: 'failed', durationMs: 1000, startTime: '2026-10-17T10:00:00Z'}],
        }),
    ];
    const output = renderClient('executionIndex()', cases);
    assert.match(output, /<details class="execution-index"/);
    assert.ok(output.indexOf('data-open="early"') < output.indexOf('data-open="later"'));
    assert.match(output, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(output, /<img src=x/);
    assert.match(output, /class="badge b-failed">failed/);
    assert.match(output, /2\.0s/);
});

test('the overview prioritizes investigation before coverage and keeps the execution register last', () => {
    const output = renderClient(
        `const panel = {}; document.getElementById = () => panel; renderOverview(); panel.innerHTML`,
        [reportCase('fail', 'unexpected')],
    );
    assert.ok(output.indexOf('Investigation worklist') < output.indexOf('Coverage lenses'));
    assert.ok(output.indexOf('Time budget') < output.indexOf('Execution register'));
    assert.match(output, /not confirmed root causes/);
    assert.doesNotMatch(output, /Every test in run order|Needs attention|Failure clusters|Slowest tests/);
    assert.match(output, /Flaky tests/);
    assert.doesNotMatch(output, /Flakiest tests/);
});

test('API results are visible on the overview and count failed, successful and unanswered calls', () => {
    const cases = [
        reportCase('api', 'unexpected', {
            apiCalls: [
                {method: 'GET', url: 'https://example.test/orders', status: 200, durationMs: 10},
                {method: 'POST', url: 'https://example.test/pay', status: 503, durationMs: 20},
                {method: 'GET', url: 'https://example.test/offline', status: 0, durationMs: 30},
            ],
        }),
        reportCase('ui', 'expected'),
    ];
    const output = renderClient('apiOverviewPanel()', cases);
    assert.match(output, /API results/);
    assert.match(output, /href="#api" data-tab="api"/);
    assert.match(output, /Recorded calls<\/dt><dd>3/);
    assert.match(output, /Failed \/ no response<\/dt><dd>2/);
    assert.match(output, /Tests with API evidence<\/dt><dd>1/);
    assert.match(renderClient('apiOverviewPanel()'), /No API calls were recorded/);
});

test('AI fixes separates saved analysis from validated fixes and escapes model text', () => {
    const output = renderClient(
        `const nodes = {aiFixesList: {}, aiFixesSummary: {}}; document.getElementById = (id) => nodes[id]; renderAiFixes(); nodes.aiFixesList.innerHTML + nodes.aiFixesSummary.textContent`,
        [
            reportCase('analyzed', 'unexpected'),
            reportCase('validated', 'unexpected'),
            reportCase('missing', 'unexpected'),
        ],
        [],
        {
            failures: [
                {testId: 'analyzed', analysis: '<script>unsafe</script>', errorMessage: 'boom'},
                {testId: 'validated', analysis: 'Change the locator', fixAccepted: true, errorMessage: 'boom'},
            ],
        },
    );
    assert.match(output, /2 analyzed · 1 validated fixes · 1 failed tests without analysis/);
    assert.match(output, /Analysis only/);
    assert.match(output, /Fix validated/);
    assert.match(output, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(output, /<script>unsafe/);
    const empty = renderClient(
        `const nodes = {aiFixesList: {}, aiFixesSummary: {}}; document.getElementById = (id) => nodes[id]; renderAiFixes(); nodes.aiFixesList.innerHTML`,
    );
    assert.match(empty, /No AI analysis was saved/);
});

test('settings shows recorded values without rendering arbitrary properties or assuming legacy defaults', () => {
    const output = renderClient(`settingsPanel(input.reportSettings, 'Run configuration')`, [], [], {
        reportSettings: {
            generateFix: false,
            slowTestThreshold: 7,
            workers: 2,
            apiKey: 'never-display-secret',
            projects: [{name: '<chromium>', retries: 1, timeoutMs: 30000}],
        },
    });
    assert.match(output, /AI fix suggestions<\/dt><dd>Disabled/);
    assert.match(output, /Slow test threshold \(seconds\)<\/dt><dd>7/);
    assert.match(output, /&lt;chromium&gt;/);
    assert.doesNotMatch(output, /never-display-secret|apiKey/);
    assert.match(renderClient(`settingsPanel(undefined, 'Legacy')`), /Settings were not recorded/);
});

test('merged reports show per-source settings without pretending all shards shared one configuration', () => {
    const output = renderClient(
        `const node = {}; document.getElementById = () => node; renderSettings(); node.innerHTML`,
        [],
        [],
        {merge: {sources: [{name: 'First shard', reportSettings: {workers: 2}}, {name: 'Legacy shard'}]}},
    );
    assert.match(output, /settings are shown per source/);
    assert.match(output, /First shard/);
    assert.match(output, /Workers<\/dt><dd>2/);
    assert.match(output, /Legacy shard/);
    assert.match(output, /Settings were not recorded/);
});

test('section headers include a decorative icon, subtitle and keyboard-operable information disclosure', () => {
    const output = renderClient(`sectionHeading('API results', 'Captured calls', '<Check evidence>', 'api')`);
    assert.match(output, /class="section-icon"><svg/);
    assert.match(output, /<h3>API results<\/h3><p>Captured calls<\/p>/);
    assert.match(output, /<details class="section-info"><summary aria-label="About API results">/);
    assert.match(output, /&lt;Check evidence&gt;/);
});

test('AI fix cards expose evidence and copy actions without applying code', () => {
    const output = renderClient(
        `aiFixCard(tests[0]) + fixPrompt(tests[0])`,
        [reportCase('ai', 'unexpected', {testFile: 'sample.spec.ts'})],
        [],
        {failures: [{testId: 'ai', analysis: 'Check locator', errorMessage: 'Element missing'}]},
    );
    assert.match(output, /Observed test failure/);
    assert.match(output, /data-act="copy-fix-prompt"/);
    assert.match(output, /data-act="copy-ai-analysis"/);
    assert.match(output, /sample\.spec\.ts/);
    assert.match(output, /Do not apply or publish changes without approval/);
});
