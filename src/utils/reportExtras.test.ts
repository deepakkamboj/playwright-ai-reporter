import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isMetaAttachment, isRecordedAttachment, readApiCalls, readMeta} from './testReportData';
import {buildSummaryMarkdown} from './summaryMarkdown';
import {AttemptInfo, TestCaseDetails, TestSummary} from '../types';

const attempt = (attachments: AttemptInfo['attachments']): AttemptInfo => ({
    status: 'failed',
    duration: 1,
    errors: [],
    attachments,
});

test('metadata attachments are recognised by name or by content type', () => {
    assert.equal(isMetaAttachment({name: 'meta', contentType: 'application/json'}), true);
    assert.equal(isMetaAttachment({name: 'workshop:meta', contentType: 'application/x-workshop-meta'}), true);
    assert.equal(isMetaAttachment({name: 'x', contentType: 'application/x-any-meta'}), true);
    assert.equal(isMetaAttachment({name: 'screenshot', contentType: 'image/png'}), false);
    assert.equal(isRecordedAttachment({name: 'api-calls', contentType: 'application/json'}), true);
});

test('metadata comes from the latest attempt that declared any', () => {
    const body = (owner: string): string => JSON.stringify({owner, priority: 'P1'});
    const meta = readMeta([
        attempt([{name: 'meta', contentType: 'application/json', body: body('first')}]),
        attempt([{name: 'meta', contentType: 'application/json', body: body('second')}]),
        attempt([]),
    ]);

    assert.deepEqual(meta, {owner: 'second', priority: 'P1'});
});

test('damaged or non-object metadata is ignored instead of breaking the run', () => {
    assert.equal(readMeta([attempt([{name: 'meta', contentType: 'x', body: '{oops'}])]), undefined);
    assert.equal(readMeta([attempt([{name: 'meta', contentType: 'x', body: '[1,2]'}])]), undefined);
    assert.equal(readMeta([attempt([{name: 'meta', contentType: 'x'}])]), undefined);
});

test('API calls are read from the attempt that carries them', () => {
    const calls = [{method: 'GET', url: 'https://x.test/a', status: 500, durationMs: 12}];
    const read = readApiCalls(attempt([{name: 'api-calls', contentType: 'application/json', body: JSON.stringify(calls)}]));

    assert.equal(read?.[0]?.status, 500);
    assert.equal(readApiCalls(attempt([])), undefined);
    assert.equal(readApiCalls(attempt([{name: 'api-calls', contentType: 'x', body: 'nope'}])), undefined);
});

const summary = (over: Partial<TestSummary> = {}): TestSummary => ({
    failures: [
        {
            testId: 'a',
            testTitle: 'pays | with card',
            suiteTitle: 's',
            owningTeam: 'pay-qa',
            errorMessage: 'Error: expected 200\nreceived 500',
            errorStack: '',
            duration: 1,
            isTimeout: false,
            errorCategory: 'x',
        },
    ],
    testCount: 4,
    passedCount: 2,
    skippedCount: 1,
    failedCount: 1,
    totalTimeDisplay: '12s',
    averageTime: 1,
    slowestTest: 1,
    slowestTests: [],
    ...over,
});

test('the Markdown summary lists failing tests with owner, priority and verdict, and escapes table pipes', () => {
    const tests: TestCaseDetails[] = [
        {
            testId: 'a',
            testTitle: 'pays | with card',
            suiteTitle: 's',
            outcome: 'unexpected',
            owningTeam: 'pay-qa',
            meta: {priority: 'P0'},
            flakiness: {
                verdict: 'new-failure',
                failureRate: 100,
                runs: 1,
                patterns: [],
                primaryPattern: 'x',
                evidence: [],
                recommendation: '',
            },
        },
        {testId: 'b', testTitle: 'fine', suiteTitle: 's', outcome: 'expected'},
    ];

    const markdown = buildSummaryMarkdown(summary(), tests, 'test-health-report.html');

    assert.match(markdown, /2 of 3 passed \(67%\)/);
    assert.match(markdown, /pays \\\| with card \| P0 \| pay-qa \| New failure \| Error: expected 200/);
    assert.doesNotMatch(markdown, /\| fine \|/);
    assert.match(markdown, /test-health-report\.html/);
});

test('the Markdown summary has no table when everything passed', () => {
    const markdown = buildSummaryMarkdown(summary({failures: [], failedCount: 0, passedCount: 3}), [], undefined);

    assert.doesNotMatch(markdown, /\| Test \|/);
    assert.match(markdown, /3 of 3 passed \(100%\)/);
});
