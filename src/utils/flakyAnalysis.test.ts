import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AttemptSummary} from '../types';
import {analyzeFlakiness, classifyError, HistoryTestEntry, RunStatus} from './flakyAnalysis';

const attempt = (retry: number, status: string, error?: string): AttemptSummary => ({
    retry,
    status,
    durationMs: 1000,
    ...(error ? {error} : {}),
});

const run = (status: RunStatus, kind?: string): HistoryTestEntry => ({
    status,
    durationMs: 1000,
    ...(kind ? {kind} : {}),
});

const ESC = String.fromCharCode(27);

test('classifies errors by what they say happened', () => {
    assert.equal(classifyError('Error: net::ERR_CONNECTION_RESET at https://x'), 'Network');
    assert.equal(
        classifyError('Error: strict mode violation: getByLabel("Password") resolved to 2 elements'),
        'Ambiguous locator',
    );
    assert.equal(
        classifyError(
            'Error: expect(locator).toHaveCount(expected) failed\n\nLocator: x\nExpected: 10\nReceived: 0\nTimeout:  100ms',
        ),
        'Assertion timing',
    );
    assert.equal(classifyError('Error: expect(received).toBe(expected)\nExpected: 1\nReceived: 2'), 'Assertion');
    assert.equal(
        classifyError("TimeoutError: locator.fill: Timeout 8000ms exceeded.\nwaiting for getByTestId('x')"),
        'Element not ready',
    );
    assert.equal(classifyError(''), 'Unknown');
    assert.equal(classifyError(undefined), 'Unknown');
});

test('ignores terminal colour codes when classifying', () => {
    assert.equal(
        classifyError(`Error: ${ESC}[2mexpect(${ESC}[22mlocator${ESC}[2m).toHaveCount${ESC}[22m failed Timeout: 100ms`),
        'Assertion timing',
    );
});

test('a test that failed then passed on retry is flaky', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', 'Error: net::ERR_X'), attempt(1, 'passed')],
        finalStatus: 'flaky',
        history: [],
    });

    assert.equal(report.verdict, 'flaky');
    assert.equal(report.primaryPattern, 'Network');
    assert.match(report.evidence.join(' '), /Failed on attempt 1, then passed on retry 1/);
});

test('a test that fails every attempt with the same error is a consistent failure, not flaky', () => {
    const error = "TimeoutError: locator.fill: Timeout 8000ms exceeded. waiting for getByTestId('a')";
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', error), attempt(1, 'failed', error)],
        finalStatus: 'failed',
        history: [],
    });

    assert.equal(report.verdict, 'consistent-failure');
    assert.equal(report.primaryPattern, 'Element not ready');
    assert.match(report.evidence.join(' '), /same error on every failed attempt/);
    assert.match(report.recommendation, /stale/);
});

test('different errors on different attempts point at a race', () => {
    const report = analyzeFlakiness({
        attempts: [
            attempt(0, 'failed', 'Error: net::ERR_A'),
            attempt(1, 'failed', 'Error: expect(x).toBe(y)\nExpected: 1\nReceived: 2'),
        ],
        finalStatus: 'failed',
        history: [],
    });

    assert.match(report.evidence.join(' '), /Different errors on different attempts/);
});

test('a first-ever single failure is new', () => {
    const report = analyzeFlakiness({attempts: [attempt(0, 'failed', 'boom')], finalStatus: 'failed', history: []});

    assert.equal(report.verdict, 'new-failure');
});

test('a failure after passing runs is new, and one after failing runs is consistent', () => {
    const attempts = [attempt(0, 'failed', 'boom')];

    assert.equal(
        analyzeFlakiness({attempts, finalStatus: 'failed', history: [run('passed'), run('passed')]}).verdict,
        'new-failure',
    );
    assert.equal(
        analyzeFlakiness({attempts, finalStatus: 'failed', history: [run('failed'), run('failed')]}).verdict,
        'consistent-failure',
    );
});

test('a failure that repeats after a pass is a consistent failure from then on', () => {
    const attempts = [attempt(0, 'failed', 'boom')];

    const report = analyzeFlakiness({attempts, finalStatus: 'failed', history: [run('passed'), run('failed')]});

    assert.equal(report.verdict, 'consistent-failure');
    assert.match(report.evidence.join(' '), /for 2 runs in a row/);
});

test('a failure streak that ends in a pass is a fix, not flakiness', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'passed')],
        finalStatus: 'passed',
        history: [run('passed'), run('failed'), run('failed')],
    });

    assert.equal(report.verdict, 'stable');
});

test('a one-off failure that recovered straight away is flaky, but an old one is not', () => {
    const passing = [attempt(0, 'passed')];

    assert.equal(
        analyzeFlakiness({attempts: passing, finalStatus: 'passed', history: [run('passed'), run('failed')]}).verdict,
        'flaky',
    );
    assert.equal(
        analyzeFlakiness({
            attempts: passing,
            finalStatus: 'passed',
            history: [run('passed'), run('failed'), run('passed'), run('passed')],
        }).verdict,
        'stable',
    );
});

test('a test that failed, recovered and failed again is flaky', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', 'boom')],
        finalStatus: 'failed',
        history: [run('failed'), run('passed'), run('failed')],
    });

    assert.equal(report.verdict, 'flaky');
});

test('a test that flaked a while ago is no longer flaky once it passes first time again', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'passed')],
        finalStatus: 'passed',
        history: [run('flaky'), run('passed'), run('passed')],
    });

    assert.equal(report.verdict, 'stable');
});

test('a result that flips back and forth across runs is flaky even when this run is plain', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', 'boom')],
        finalStatus: 'failed',
        history: [run('failed'), run('passed'), run('failed')],
    });

    assert.equal(report.verdict, 'flaky');
    assert.match(report.evidence.join(' '), /Result changed 2 times/);
});

test('a test that was fixed and stays green is stable', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'passed')],
        finalStatus: 'passed',
        history: [run('failed'), run('failed'), run('passed')],
    });

    assert.equal(report.verdict, 'stable');
});

test('a pass between two failures is recent instability', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'passed')],
        finalStatus: 'passed',
        history: [run('passed'), run('failed')],
    });

    assert.equal(report.verdict, 'flaky');
});

test('failure rate counts runs that did not pass first time, including this one', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', 'x'), attempt(1, 'passed')],
        finalStatus: 'flaky',
        history: [run('passed'), run('passed'), run('failed')],
    });

    assert.equal(report.runs, 4);
    assert.equal(report.failureRate, 50);
});

test('skipped runs are ignored', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'passed')],
        finalStatus: 'passed',
        history: [run('skipped'), run('skipped')],
    });

    assert.equal(report.runs, 1);
    assert.equal(report.verdict, 'stable');
});

test('patterns from history count towards the most common kind', () => {
    const report = analyzeFlakiness({
        attempts: [attempt(0, 'failed', 'Error: net::ERR_X'), attempt(1, 'passed')],
        finalStatus: 'flaky',
        history: [run('flaky', 'Assertion timing'), run('flaky', 'Assertion timing')],
    });

    assert.equal(report.primaryPattern, 'Assertion timing');
    assert.deepEqual(report.patterns, ['Assertion timing', 'Network']);
});

test('no recommendation ever tells people to raise a timeout or sleep', () => {
    const kinds = [
        'net::ERR_X',
        'strict mode violation',
        'expect(a).toBe(b) Timeout: 5ms',
        'expect(a).toBe(b)\nExpected: 1',
        'Timeout 5ms exceeded',
        '',
    ];

    for (const error of kinds) {
        const {recommendation} = analyzeFlakiness({
            attempts: [attempt(0, 'failed', error)],
            finalStatus: 'failed',
            history: [],
        });

        // A sentence may warn against these ("Do not raise timeouts"), but none may recommend them.
        const advice = recommendation.split(/(?<=\.)\s+/).filter((sentence) => !/^do not\b/i.test(sentence));
        assert.doesNotMatch(advice.join(' '), /increase|raise|add a (fixed )?sleep|waitForTimeout|longer timeout/i);
    }
});
