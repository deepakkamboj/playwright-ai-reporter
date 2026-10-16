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
function fakeTest(
    title: string,
    outcomes: string[],
    location = {file: path.join(os.tmpdir(), 'spec.ts'), line: 1, column: 1},
): {test: TestCase; next: () => void} {
    let attempt = -1;
    const test = {
        id: `id-${title}`,
        title,
        parent: {title: 'suite'},
        location,
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

interface ResultOptions {
    message?: string;
    attachments?: Array<{name: string; contentType: string; path?: string; body?: Buffer}>;
    location?: {file: string; line: number; column: number};
}

function result(status: TestResult['status'], retry: number, options: ResultOptions = {}): TestResult {
    return {
        status,
        retry,
        duration: 1000,
        errors:
            status === 'passed' ? [] : [{message: options.message ?? 'Timeout 8000ms exceeded', stack: 'at spec.ts:1'}],
        attachments: options.attachments ?? [],
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

interface Scenario extends ResultOptions {
    title: string;
    outcomes: string[];
    statuses: TestResult['status'][];
}

async function run(
    reporter: PlaywrightTestReporter,
    scenarios: Scenario[],
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
        const {test: fake, next} = fakeTest(scenario.title, scenario.outcomes, scenario.location);
        scenario.statuses.forEach((status, retry) => {
            next();
            reporter.onTestEnd(fake, result(status, retry, scenario));
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

const ESC = String.fromCharCode(27);

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as T;

interface WrittenFailure {
    errorMessage: string;
    retryCount?: number;
    artifacts?: {trace?: {href: string; path: string}; screenshot?: {href: string}; video?: {href: string}};
    flakiness?: {verdict: string; primaryPattern: string; evidence: string[]};
}

const failedScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
    title: 'fails',
    outcomes: ['unexpected'],
    statuses: ['failed'],
    ...overrides,
});

test('written files carry no terminal colour codes', async () => {
    await run(
        new PlaywrightTestReporter({outputDir: directory}),
        [failedScenario({message: `${ESC}[2mexpect(${ESC}[22mlocator${ESC}[2m).toHaveCount${ESC}[22m failed`})],
        'failed',
    );

    const [failure] = readJson<WrittenFailure[]>('testFailures.json');

    assert.equal(failure?.errorMessage, 'expect(locator).toHaveCount failed');
    assert.doesNotMatch(fs.readFileSync(path.join(directory, 'testSummary.json'), 'utf8'), /\\u001b/);
});

test('comment metadata is opt-in and explicit attachments override it', async () => {
    const testFile = path.join(directory, 'metadata.spec.ts');
    fs.writeFileSync(
        testFile,
        [
            '/**',
            ' * @priority P2',
            ' * @owner comment-owner',
            ' * @feature checkout',
            ' */',
            "test('metadata', async () => {});",
        ].join('\n'),
    );

    await run(new PlaywrightTestReporter({outputDir: directory, commentMetadata: true}), [
        {
            title: 'metadata',
            outcomes: ['expected'],
            statuses: ['passed'],
            location: {file: testFile, line: 6, column: 1},
            attachments: [
                {
                    name: 'meta',
                    contentType: 'application/json',
                    body: Buffer.from(JSON.stringify({priority: 'P0', owner: 'attachment-owner'})),
                },
            ],
        },
    ]);

    const summary = readJson<{
        allTestCases: Array<{meta?: Record<string, unknown>; owningTeam?: string}>;
    }>('testSummary.json');
    assert.deepEqual(summary.allTestCases[0]?.meta, {
        priority: 'P0',
        owner: 'attachment-owner',
        feature: 'checkout',
    });
    assert.equal(summary.allTestCases[0]?.owningTeam, 'attachment-owner');
});

test('all generated report artifacts redact failure credentials', async () => {
    const secret = 'artifact-secret-123456789';
    await run(
        new PlaywrightTestReporter({outputDir: directory}),
        [failedScenario({message: `password=${secret}; repeated ${secret}`})],
        'failed',
    );

    for (const file of ['testFailures.json', 'testSummary.json', 'test-health-report.html', 'summary.md']) {
        const content = fs.readFileSync(path.join(directory, file), 'utf8');
        assert.doesNotMatch(content, new RegExp(secret), file);
        assert.match(content, /\*\*\*\*/, file);
    }
});

test('a failed test links its trace, screenshot and video relative to the report', async () => {
    const folder = path.join(directory, 'fails-chromium');
    fs.mkdirSync(folder, {recursive: true});
    const files = ['trace.zip', 'test-failed-1.png', 'video.webm'].map((name) => {
        const file = path.join(folder, name);
        fs.writeFileSync(file, 'x');
        return file;
    });

    await run(
        new PlaywrightTestReporter({outputDir: directory}),
        [
            failedScenario({
                attachments: [
                    {name: 'trace', contentType: 'application/zip', path: files[0]},
                    {name: 'screenshot', contentType: 'image/png', path: files[1]},
                    {name: 'video', contentType: 'video/webm', path: files[2]},
                ],
            }),
        ],
        'failed',
    );

    const [failure] = readJson<WrittenFailure[]>('testFailures.json');

    assert.equal(failure?.artifacts?.trace?.href, 'fails-chromium/trace.zip');
    assert.equal(failure?.artifacts?.screenshot?.href, 'fails-chromium/test-failed-1.png');
    assert.equal(failure?.artifacts?.video?.href, 'fails-chromium/video.webm');
    assert.match(failure?.artifacts?.trace?.path ?? '', /fails-chromium\/trace\.zip$/);
});

test('a test that failed then passed on retry is reported as flaky with its evidence', async () => {
    await run(new PlaywrightTestReporter({outputDir: directory}), [
        {
            title: 'flaky',
            outcomes: ['unexpected', 'flaky'],
            statuses: ['failed', 'passed'],
            message: 'Error: net::ERR_CONNECTION_RESET',
        },
    ]);

    const summary = readJson<{
        allTestCases: Array<{retryCount: number; attempts: unknown[]; flakiness: WrittenFailure['flakiness']}>;
    }>('testSummary.json');
    const [flaky] = summary.allTestCases;

    assert.equal(flaky?.retryCount, 1);
    assert.equal(flaky?.attempts.length, 2);
    assert.equal(flaky?.flakiness?.verdict, 'flaky');
    assert.equal(flaky?.flakiness?.primaryPattern, 'Network');
    assert.match(flaky?.flakiness?.evidence.join(' ') ?? '', /Failed on attempt 1, then passed on retry 1/);
});

test('failures from an earlier run do not pile up in testFailures.json', async () => {
    await run(new PlaywrightTestReporter({outputDir: directory}), [failedScenario({title: 'first run'})], 'failed');
    await run(new PlaywrightTestReporter({outputDir: directory}), [failedScenario({title: 'second run'})], 'failed');

    const failures = readJson<Array<{testTitle: string}>>('testFailures.json');

    assert.deepEqual(
        failures.map((failure) => failure.testTitle),
        ['second run'],
    );
});

test('a retried failure appears once, not once per attempt', async () => {
    await run(
        new PlaywrightTestReporter({outputDir: directory}),
        [failedScenario({outcomes: ['unexpected', 'unexpected'], statuses: ['failed', 'failed']})],
        'failed',
    );

    const [failure, ...others] = readJson<WrittenFailure[]>('testFailures.json');

    assert.equal(others.length, 0);
    assert.equal(failure?.retryCount, 1);
});

test('history tells a repeat failure from a new one and a flaky one from both', async () => {
    const reporter = () => new PlaywrightTestReporter({outputDir: directory});
    const verdict = (): string | undefined => readJson<WrittenFailure[]>('testFailures.json')[0]?.flakiness?.verdict;

    await run(reporter(), [{title: 'fails', outcomes: ['expected'], statuses: ['passed']}]);
    await run(reporter(), [failedScenario()], 'failed');
    assert.equal(verdict(), 'new-failure');

    await run(reporter(), [failedScenario()], 'failed');
    assert.equal(verdict(), 'consistent-failure');

    await run(reporter(), [{title: 'fails', outcomes: ['expected'], statuses: ['passed']}]);
    await run(reporter(), [failedScenario()], 'failed');
    assert.equal(verdict(), 'flaky');
});

test('history can be kept outside the output directory', async () => {
    const historyFile = path.join(directory, 'kept', 'history.json');

    await run(new PlaywrightTestReporter({outputDir: path.join(directory, 'out'), historyFile}), [
        {title: 'passes', outcomes: ['expected'], statuses: ['passed']},
    ]);

    assert.equal(fs.existsSync(historyFile), true);
    assert.equal(fs.existsSync(path.join(directory, 'out', 'history.json')), false);
});

test('an unwritable history file never fails the run', async () => {
    const blocker = path.join(directory, 'blocker');
    fs.writeFileSync(blocker, 'a file, not a directory');

    await run(new PlaywrightTestReporter({outputDir: directory, historyFile: path.join(blocker, 'history.json')}), [
        {title: 'passes', outcomes: ['expected'], statuses: ['passed']},
    ]);

    assert.equal(process.exitCode, 0);
});
