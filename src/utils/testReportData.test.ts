import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, beforeEach, test} from 'node:test';
import {HistoryRun, historyFor, loadHistory, MAX_HISTORY_RUNS, recordRun, saveHistory, testKey} from './historyStore';
import {collectArtifacts, describeTest, statusOf, summarizeAttempts} from './testReportData';
import {AttemptInfo, TestRecord} from '../types';

const ESC = String.fromCharCode(27);

let directory: string;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'report-data-'));
});

afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
});

const touch = (...parts: string[]): string => {
    const file = path.join(directory, ...parts);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, 'x');
    return file;
};

test('statusOf maps Playwright outcomes to history statuses', () => {
    assert.equal(statusOf('expected'), 'passed');
    assert.equal(statusOf('flaky'), 'flaky');
    assert.equal(statusOf('skipped'), 'skipped');
    assert.equal(statusOf('unexpected'), 'failed');
    assert.equal(statusOf(undefined), 'failed');
});

test('attempt summaries drop colour codes and keep only the first error line', () => {
    const attempts: AttemptInfo[] = [
        {
            status: 'failed',
            duration: 1.25,
            retry: 0,
            errors: [
                {message: `${ESC}[31mError: expect(x).toHaveCount(y) failed${ESC}[39m\n\nLocator: z\nTimeout: 100ms`},
            ],
        },
        {status: 'passed', duration: 0.5, retry: 1, errors: []},
    ];

    const [failed, passed] = summarizeAttempts(attempts);

    assert.equal(failed?.error, 'Error: expect(x).toHaveCount(y) failed');
    assert.equal(failed?.kind, 'Assertion timing');
    assert.equal(failed?.durationMs, 1250);
    assert.equal(passed?.error, undefined);
    assert.equal(passed?.retry, 1);
});

test('artifact links are relative to the report and to the working directory, and only exist when the file does', () => {
    const trace = touch('artifacts', 'a-test', 'trace.zip');
    const screenshot = touch('artifacts', 'a-test', 'test-failed-1.png');
    const reportDir = path.join(directory, 'artifacts');

    const artifacts = collectArtifacts(
        [
            {name: 'trace', contentType: 'application/zip', path: trace},
            {name: 'screenshot', contentType: 'image/png', path: screenshot},
            {name: 'video', contentType: 'video/webm', path: path.join(directory, 'missing.webm')},
            {name: 'browser-console.json', contentType: 'application/json'},
        ],
        reportDir,
        directory,
    );

    assert.deepEqual(artifacts.trace, {href: 'a-test/trace.zip', path: 'artifacts/a-test/trace.zip'});
    assert.equal(artifacts.screenshot?.href, 'a-test/test-failed-1.png');
    assert.equal(artifacts.video, undefined);
    assert.equal(artifacts.errorContext, undefined);
});

test('a flaky test points at the artifacts of its failed attempt, not the passing one', () => {
    const failedTrace = touch('artifacts', 'first', 'trace.zip');
    const passedTrace = touch('artifacts', 'second', 'trace.zip');
    const record: TestRecord = {
        test: {testTitle: 't', suiteTitle: 's', outcome: 'flaky'},
        attempts: [
            {
                status: 'failed',
                duration: 1,
                retry: 0,
                errors: [{message: 'net::ERR_X'}],
                attachments: [{name: 'trace', contentType: 'application/zip', path: failedTrace}],
            },
            {
                status: 'passed',
                duration: 1,
                retry: 1,
                errors: [],
                attachments: [{name: 'trace', contentType: 'application/zip', path: passedTrace}],
            },
        ],
    };

    const data = describeTest(record, [], path.join(directory, 'artifacts'));

    assert.equal(data.retryCount, 1);
    assert.match(data.artifacts.trace?.href ?? '', /first\/trace\.zip$/);
    assert.equal(data.flakiness.verdict, 'flaky');
});

test('attachment metadata overrides comment metadata while preserving other comment tags', () => {
    const record: TestRecord = {
        test: {
            testTitle: 't',
            suiteTitle: 's',
            outcome: 'expected',
            meta: {priority: 'P2', owner: 'comment-owner', feature: 'checkout'},
        },
        attempts: [
            {
                status: 'passed',
                duration: 1,
                errors: [],
                attachments: [
                    {
                        name: 'meta',
                        contentType: 'application/json',
                        body: JSON.stringify({priority: 'P0', owner: 'attachment-owner'}),
                    },
                ],
            },
        ],
    };

    const data = describeTest(record, [], directory);

    assert.deepEqual(data.meta, {
        priority: 'P0',
        owner: 'attachment-owner',
        feature: 'checkout',
    });
});

test('history keeps the most recent runs only', () => {
    let runs: HistoryRun[] = [];
    for (let index = 0; index < MAX_HISTORY_RUNS + 5; index++) {
        runs = recordRun(runs, {time: String(index), tests: {}});
    }

    assert.equal(runs.length, MAX_HISTORY_RUNS);
    assert.equal(runs[0]?.time, '5');
});

test('history round-trips through the file and tolerates a missing or damaged file', () => {
    const file = path.join(directory, 'nested', 'history.json');
    assert.deepEqual(loadHistory(file), []);

    saveHistory(file, [{time: 't', tests: {a: {status: 'passed', durationMs: 1}}}]);
    assert.equal(loadHistory(file)[0]?.tests.a?.status, 'passed');

    fs.writeFileSync(file, '{not json');
    assert.deepEqual(loadHistory(file), []);

    fs.writeFileSync(file, JSON.stringify({not: 'an array'}));
    assert.deepEqual(loadHistory(file), []);
});

test('a test key is stable across machines and runs', () => {
    const absolute = path.join(directory, 'tests', 'a.spec.ts');

    assert.equal(testKey(absolute, 'works', directory), 'tests/a.spec.ts::works');
    assert.equal(testKey('tests/a.spec.ts', 'works', directory), 'tests/a.spec.ts::works');
    assert.equal(testKey(undefined, 'works', directory), '::works');
});

test('historyFor returns one test oldest first and skips runs without it', () => {
    const runs: HistoryRun[] = [
        {time: '1', tests: {a: {status: 'passed', durationMs: 1}}},
        {time: '2', tests: {b: {status: 'failed', durationMs: 1}}},
        {time: '3', tests: {a: {status: 'failed', durationMs: 1}}},
    ];

    assert.deepEqual(
        historyFor(runs, 'a').map((entry) => entry.status),
        ['passed', 'failed'],
    );
});
