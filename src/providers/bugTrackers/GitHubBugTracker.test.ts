import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BugDetails, BugPriority} from '../interfaces/IBugTrackerProvider';
import {GitHubBugTracker} from './GitHubBugTracker';

interface Call {
    assignees?: string[];
    labels?: string[];
    body?: string;
}

async function trackerWith(create: (params: Call) => Promise<unknown>): Promise<GitHubBugTracker> {
    const tracker = new GitHubBugTracker({owner: 'o', repo: 'r', token: 't'});
    // initialize() builds the real client asynchronously; replace it only after it has finished.
    await (tracker as unknown as {initialized: Promise<void>}).initialized;
    (tracker as unknown as {octokit: unknown}).octokit = {
        search: {issuesAndPullRequests: async () => ({data: {items: []}})},
        issues: {create},
    };
    return tracker;
}

const details = (assignee?: string): BugDetails => ({
    title: '[Test Failure] x',
    description: 'd',
    priority: BugPriority.Medium,
    labels: ['test-failure'],
    ...(assignee ? {assignee} : {}),
    testFailure: {} as BugDetails['testFailure'],
});

const created = (number = 7) => ({data: {number, html_url: `https://x/issues/${number}`, title: '[Test Failure] x'}});

const rejectedAssignee = () =>
    Object.assign(new Error('Validation Failed: {"message":"assignees unknown cannot be assigned"}'), {status: 422});

test('the issue body is the reporter description, so the analysis and run link reach GitHub', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        return created();
    });

    await tracker.createBug({
        ...details(),
        description:
            '## Test Failure Report\n\n### Root cause analysis (AI)\nDomain: Test\n\n### Run\n- **Run**: https://x/runs/1',
    });

    assert.match(calls[0]?.body ?? '', /### Root cause analysis \(AI\)\nDomain: Test/);
    assert.match(calls[0]?.body ?? '', /\*\*Run\*\*: https:\/\/x\/runs\/1/);
    assert.doesNotMatch(calls[0]?.body ?? '', /automatically created by the Playwright AI Test Reporter/);
});

test('redacts direct provider payloads before creating an issue', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        return created();
    });
    const secret = 'provider-secret-123456789';

    await tracker.createBug({...details(), description: `password=${secret}; repeated ${secret}`});

    assert.doesNotMatch(calls[0]?.body ?? '', new RegExp(secret));
    assert.match(calls[0]?.body ?? '', /\*\*\*\*/);
});

test('falls back to a generated body when no description is given', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        return created();
    });

    await tracker.createBug({
        ...details(),
        description: '   ',
        testFailure: {
            testTitle: 'x',
            suiteTitle: 's',
            errorMessage: 'boom',
            errorStack: '',
            owningTeam: 'QA',
            duration: 1,
            isTimeout: false,
            errorCategory: 'Unknown',
        },
    });

    assert.match(calls[0]?.body ?? '', /## Test Information[\s\S]*boom/);
});

test('files the issue with the requested assignee when GitHub accepts it', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        return created();
    });

    const bug = await tracker.createBug(details('octocat'));

    assert.equal(bug?.id, '7');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.assignees, ['octocat']);
});

test('files the issue unassigned when GitHub rejects the assignee', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        if (params.assignees) {
            throw rejectedAssignee();
        }
        return created(9);
    });
    const warn = console.warn;
    console.warn = () => undefined;

    try {
        const bug = await tracker.createBug(details('not-a-user'));

        assert.equal(bug?.id, '9');
        assert.equal(calls.length, 2);
        assert.equal(calls[1]?.assignees, undefined);
    } finally {
        console.warn = warn;
    }
});

test('sends no assignees at all when none was requested', async () => {
    const calls: Call[] = [];
    const tracker = await trackerWith(async (params) => {
        calls.push(params);
        return created();
    });

    await tracker.createBug(details());

    assert.equal('assignees' in (calls[0] ?? {}), false);
});

test('other GitHub errors still return null instead of retrying', async () => {
    let attempts = 0;
    const tracker = await trackerWith(async () => {
        attempts++;
        throw Object.assign(new Error('Server Error'), {status: 500});
    });
    const error = console.error;
    console.error = () => undefined;

    try {
        assert.equal(await tracker.createBug(details('octocat')), null);
        assert.equal(attempts, 1);
    } finally {
        console.error = error;
    }
});
