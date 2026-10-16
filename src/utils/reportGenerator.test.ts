import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, beforeEach, test} from 'node:test';
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
