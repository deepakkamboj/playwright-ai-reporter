import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, test} from 'node:test';
import {FullConfig, FullResult, Suite, TestCase, TestResult} from '@playwright/test/reporter';
import {BugInfo, BugStatus, IBugTrackerProvider} from './providers/interfaces/IBugTrackerProvider';
import {ProviderRegistry} from './providers/ProviderRegistry';
import PlaywrightTestReporter from './reporter';

const registry = ProviderRegistry as unknown as {getBugTrackerProvider: () => Promise<IBugTrackerProvider>};
const originalGetBugTracker = registry.getBugTrackerProvider;
const originalCwd = process.cwd();
const originalLog = console.log;
const originalWarn = console.warn;

const bug = (id: string, title: string): BugInfo => ({
    id,
    url: `https://x/issues/${id}`,
    status: BugStatus.Open,
    title,
});

class FakeTracker implements IBugTrackerProvider {
    closed: string[] = [];
    created: string[] = [];

    constructor(private readonly open: BugInfo[]) {}

    async createBug(details: {title: string}): Promise<BugInfo | null> {
        this.created.push(details.title);
        return bug('new', details.title);
    }
    async updateBug(): Promise<BugInfo | null> {
        return null;
    }
    async closeBug(id: string): Promise<BugInfo | null> {
        this.closed.push(id);
        return {...bug(id, ''), status: BugStatus.Closed};
    }
    async findBugs(): Promise<BugInfo[]> {
        return this.open;
    }
    async addComment(): Promise<boolean> {
        return true;
    }
}

/** A test whose outcome() reflects the attempts reported so far, like Playwright's. */
function fakeTest(title: string, outcomes: string[]): {test: TestCase; next: () => void} {
    let attempt = -1;
    const test = {
        id: `id-${title}`,
        title,
        parent: {title: 'suite'},
        location: {file: path.join(os.tmpdir(), 'spec.ts'), line: 1, column: 1},
        annotations: [],
        outcome: () => outcomes[Math.max(attempt, 0)],
    } as unknown as TestCase;
    return {
        test,
        next: () => {
            attempt++;
        },
    };
}

function result(status: TestResult['status'], retry: number): TestResult {
    return {
        status,
        retry,
        duration: 1000,
        errors: status === 'passed' ? [] : [{message: 'Timeout 8000ms exceeded', stack: 'at spec.ts:1'}],
    } as unknown as TestResult;
}

let directory: string;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-'));
    process.chdir(directory);
    console.log = () => undefined;
    console.warn = () => undefined;
});

afterEach(() => {
    registry.getBugTrackerProvider = originalGetBugTracker;
    process.chdir(originalCwd);
    console.log = originalLog;
    console.warn = originalWarn;
    process.exitCode = 0;
    fs.rmSync(directory, {recursive: true, force: true});
});

async function run(
    reporter: PlaywrightTestReporter,
    scenarios: Array<{title: string; outcomes: string[]; statuses: TestResult['status'][]}>,
    overall: FullResult['status'] = 'passed',
): Promise<void> {
    reporter.onBegin(
        {workers: 1, projects: [{name: 'chromium'}]} as unknown as FullConfig,
        {
            tests: [],
            suites: [],
        } as unknown as Suite,
    );

    for (const scenario of scenarios) {
        const {test: fake, next} = fakeTest(scenario.title, scenario.outcomes);
        scenario.statuses.forEach((status, retry) => {
            next();
            reporter.onTestEnd(fake, result(status, retry));
        });
    }

    await reporter.onEnd({status: overall} as FullResult);
}

test('closes bugs only for tests that passed first time', async () => {
    const tracker = new FakeTracker([
        bug('1', '[Test Failure] passes'),
        bug('2', '[Test Failure] flaky'),
        bug('3', '[Test Failure] fails'),
        bug('4', '[Test Failure] not in this run'),
    ]);
    registry.getBugTrackerProvider = async () => tracker;

    await run(new PlaywrightTestReporter({outputDir: directory, closeFixedBugs: true}), [
        {title: 'passes', outcomes: ['expected'], statuses: ['passed']},
        {title: 'flaky', outcomes: ['unexpected', 'flaky'], statuses: ['failed', 'passed']},
        {title: 'fails', outcomes: ['unexpected'], statuses: ['failed']},
    ]);

    assert.deepEqual(tracker.closed, ['1']);
});

test('does not close or create bugs unless enabled', async () => {
    const tracker = new FakeTracker([bug('1', '[Test Failure] passes')]);
    registry.getBugTrackerProvider = async () => tracker;

    await run(new PlaywrightTestReporter({outputDir: directory}), [
        {title: 'passes', outcomes: ['expected'], statuses: ['passed']},
    ]);

    assert.deepEqual(tracker.closed, []);
    assert.deepEqual(tracker.created, []);
});

test('a test that fails then passes on retry is flaky, not a failure', async () => {
    const tracker = new FakeTracker([]);
    registry.getBugTrackerProvider = async () => tracker;

    await run(new PlaywrightTestReporter({outputDir: directory, createBug: true}), [
        {title: 'flaky', outcomes: ['unexpected', 'flaky'], statuses: ['failed', 'passed']},
    ]);

    assert.deepEqual(tracker.created, []);
    assert.equal(process.exitCode, 0);
});

test('a test that fails every attempt creates a bug and fails the run', async () => {
    const tracker = new FakeTracker([]);
    registry.getBugTrackerProvider = async () => tracker;

    await run(
        new PlaywrightTestReporter({outputDir: directory, createBug: true}),
        [{title: 'fails', outcomes: ['unexpected', 'unexpected'], statuses: ['failed', 'failed']}],
        'failed',
    );

    assert.deepEqual(tracker.created, ['[Test Failure] fails']);
    assert.equal(process.exitCode, 1);
});
