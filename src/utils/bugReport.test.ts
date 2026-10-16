import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BuildInfo, TestFailure} from '../types';
import {BUG_TITLE_PREFIX, bugTitle, buildBugDescription, buildVerificationComment} from './bugReport';

const failure: TestFailure = {
    testId: 'abc-1',
    testTitle: 'stale locator blocks form',
    suiteTitle: 'contact form',
    owningTeam: 'web',
    errorMessage: 'Timeout 8000ms exceeded',
    errorStack: 'at form.page.ts:25',
    duration: 10.25,
    isTimeout: true,
    errorCategory: 'Timeout/DelayedElement',
    testFile: 'tests/labs/test-defect.spec.ts',
};

const buildInfo: BuildInfo = {
    isPipeline: true,
    executionSystem: 'GitHub Actions',
    buildLink: 'https://github.com/o/r/actions/runs/42',
    buildBranch: 'main',
    commitId: '0123456789abcdef',
    commitLink: 'https://github.com/o/r/commit/0123456789abcdef',
    artifactsLink: 'https://github.com/o/r/actions/runs/42/artifacts',
};

test('bug titles use the shared prefix', () => {
    assert.equal(bugTitle('a'), `${BUG_TITLE_PREFIX}a`);
});

test('description contains the analysis and run details when provided', () => {
    const body = buildBugDescription(failure, {analysis: 'Domain: Test. The test id was removed.', buildInfo});

    assert.match(body, /### Root cause analysis \(AI\)\nDomain: Test/);
    assert.match(body, /\*\*Run\*\*: https:\/\/github.com\/o\/r\/actions\/runs\/42/);
    assert.match(body, /\*\*Branch\*\*: main/);
    assert.match(body, /\[0123456\]\(https:\/\/github.com\/o\/r\/commit\/0123456789abcdef\)/);
    assert.match(body, /\*\*Artifacts\*\*/);
});

test('description omits the analysis and run sections when unavailable', () => {
    const body = buildBugDescription(failure, {buildInfo: {isPipeline: false, executionSystem: 'Local'}});

    assert.doesNotMatch(body, /Root cause analysis/);
    assert.doesNotMatch(body, /### Run/);
    assert.match(body, /Timeout 8000ms exceeded/);
});

test('very long analysis is truncated', () => {
    const body = buildBugDescription(failure, {analysis: 'x'.repeat(20000)});

    assert.ok(body.length < 12000);
    assert.match(body, /\(truncated\)/);
});

test('verification comment links the run', () => {
    const comment = buildVerificationComment('stale locator blocks form', buildInfo);

    assert.match(comment, /Verified fixed: "stale locator blocks form"/);
    assert.match(comment, /actions\/runs\/42/);
    assert.match(comment, /0123456/);
});

test('issue content never includes credentials from failure evidence', () => {
    const secret = 'issue-secret-123456789';
    const body = buildBugDescription({
        ...failure,
        testTitle: `failure repeated ${secret}`,
        errorMessage: `password=${secret}`,
        errorStack: `Bearer ${secret}`,
    });

    assert.doesNotMatch(body, new RegExp(secret));
    assert.doesNotMatch(bugTitle(`failure ${secret}`), new RegExp(secret));
    assert.match(body, /\*\*\*\*/);
});
