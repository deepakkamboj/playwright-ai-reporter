import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, test} from 'node:test';
import {ReportSettings, TestCaseDetails, TestFailure, TrendPoint} from '../types';
import {REPORT_SCHEMA_VERSION, ReportFileSummary} from './reportSchema';
import {mergeShardReports} from './shardMerge';

let directory: string;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-merge-'));
});

afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
});

const failure = (id: string, artifact = false): TestFailure => ({
    testId: id,
    testTitle: `test ${id}`,
    suiteTitle: 'suite',
    testFile: `tests/${id}.spec.ts`,
    owningTeam: 'QA',
    errorMessage: 'expected true to be false',
    errorStack: '',
    duration: 1,
    isTimeout: false,
    errorCategory: 'Assertion',
    attempts: [{retry: 0, status: 'failed', durationMs: 1000, workerIndex: 0}],
    ...(artifact
        ? {
              artifacts: {
                  trace: {href: 'raw/trace.zip', path: 'old/trace.zip'},
              },
              analysis: 'Domain: Test',
              analysisFile: 'raw/analysis.md',
          }
        : {}),
});

const testCase = (id: string, outcome: 'expected' | 'unexpected', artifact = false): TestCaseDetails => ({
    testId: id,
    testTitle: `test ${id}`,
    suiteTitle: 'suite',
    testFile: `tests/${id}.spec.ts`,
    project: 'chromium',
    outcome,
    status: outcome === 'expected' ? 'passed' : 'failed',
    duration: outcome === 'expected' ? 2 : 1,
    attempts: [
        {
            retry: 0,
            status: outcome === 'expected' ? 'passed' : 'failed',
            durationMs: outcome === 'expected' ? 2000 : 1000,
            workerIndex: 0,
            startTime: '2026-10-16T10:00:00.000Z',
        },
    ],
    ...(artifact
        ? {
              artifacts: {
                  screenshot: {href: 'raw/screenshot.png', path: 'old/screenshot.png'},
              },
          }
        : {}),
});

interface ShardOptions {
    schemaVersion?: number;
    buildId?: string;
    timestamp?: string;
    trend?: TrendPoint[];
    reportSettings?: ReportSettings;
}

function writeShard(
    name: string,
    tests: TestCaseDetails[],
    failures: TestFailure[],
    options: ShardOptions = {},
): string {
    const shard = path.join(directory, name);
    fs.mkdirSync(path.join(shard, 'raw'), {recursive: true});
    fs.writeFileSync(path.join(shard, 'raw', 'trace.zip'), 'trace');
    fs.writeFileSync(path.join(shard, 'raw', 'screenshot.png'), 'screenshot');
    fs.writeFileSync(path.join(shard, 'raw', 'analysis.md'), 'analysis');
    const passedCount = tests.filter((item) => item.outcome === 'expected' || item.outcome === 'flaky').length;
    const skippedCount = tests.filter((item) => item.outcome === 'skipped').length;
    const timestamp = options.timestamp ?? '2026-10-16T10:01:00.000Z';
    const summary: ReportFileSummary = {
        schemaVersion: options.schemaVersion ?? REPORT_SCHEMA_VERSION,
        failures,
        testCount: tests.length,
        passedCount,
        skippedCount,
        failedCount: failures.length,
        totalTimeDisplay: '1s',
        averageTime: 1,
        slowestTest: 1,
        slowestTests: [],
        buildInfo: {
            isPipeline: true,
            executionSystem: 'GitHub Actions',
            buildId: options.buildId ?? 'run-42',
            buildBranch: 'main',
            buildRepository: 'owner/repo',
            commitId: 'abcdef123456',
        },
        trend: options.trend ?? [
            {time: '2026-10-15T10:00:00.000Z', passed: 10, failed: 0, flaky: 0, skipped: 0},
            {time: timestamp, passed: passedCount, failed: failures.length, flaky: 0, skipped: skippedCount},
        ],
        allTestCases: tests,
        timestamp,
        runEnvironment: 'Pipeline',
        ...(options.reportSettings ? {reportSettings: options.reportSettings} : {}),
    };
    fs.writeFileSync(path.join(shard, 'testSummary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(shard, 'testFailures.json'), JSON.stringify(failures, null, 2));
    return shard;
}

test('preserves distinct settings snapshots per source and leaves legacy sources unspecified', () => {
    const settings: ReportSettings = {
        slowTestThreshold: 5,
        maxSlowTestsToShow: 3,
        timeoutWarningThreshold: 30,
        showStackTrace: true,
        commentMetadata: false,
        generateFix: false,
        generatePR: false,
        createBug: false,
        closeFixedBugs: false,
        publishToDB: false,
        sendEmail: false,
        workers: 2,
    };
    const a = writeShard('a', [testCase('a', 'expected')], [], {reportSettings: settings});
    const b = writeShard('b', [testCase('b', 'expected')], [], {reportSettings: {...settings, workers: 4}});
    const c = writeShard('c', [testCase('c', 'expected')], []);
    const merged = mergeShardReports([a, b, c], path.join(directory, 'merged'));
    const summary = JSON.parse(fs.readFileSync(merged.summaryPath, 'utf8')) as ReportFileSummary;
    assert.equal(summary.reportSettings, undefined);
    assert.deepEqual(
        summary.merge?.sources.map((source) => source.reportSettings?.workers),
        [2, 4, undefined],
    );
});

test('merges shards deterministically, renumbers workers, and copies evidence', () => {
    const failed = failure('failed', true);
    const zShard = writeShard('z-shard', [testCase('passed', 'expected', true)], [], {
        timestamp: '2026-10-16T10:02:00.000Z',
    });
    const aShard = writeShard('a-shard', [testCase('failed', 'unexpected')], [failed]);
    const analysisSecret = 'legacy-analysis-secret-123456';
    fs.writeFileSync(path.join(aShard, 'raw', 'analysis.md'), `password=${analysisSecret}; repeated ${analysisSecret}`);
    const output = path.join(directory, 'merged');

    const result = mergeShardReports([zShard, aShard], output);
    const summary = JSON.parse(fs.readFileSync(result.summaryPath, 'utf8')) as ReportFileSummary;
    const failures = JSON.parse(fs.readFileSync(result.failuresPath, 'utf8')) as TestFailure[];
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8')) as {
        schemaVersion: number;
        shardCount: number;
    };
    const html = fs.readFileSync(result.reportPath, 'utf8');

    assert.equal(summary.schemaVersion, REPORT_SCHEMA_VERSION);
    assert.equal(summary.testCount, 2);
    assert.equal(summary.passedCount, 1);
    assert.equal(summary.failedCount, 1);
    assert.deepEqual(
        summary.allTestCases.map((item) => item.testId),
        ['failed', 'passed'],
    );
    assert.equal(summary.allTestCases[0]?.attempts?.[0]?.workerIndex, 0);
    assert.equal(summary.allTestCases[1]?.attempts?.[0]?.workerIndex, 1);
    assert.deepEqual(summary.trend?.at(-1), {
        time: '2026-10-16T10:02:00.000Z',
        runId: 'run-42',
        passed: 1,
        failed: 1,
        flaky: 0,
        skipped: 0,
    });
    assert.equal(manifest.schemaVersion, REPORT_SCHEMA_VERSION);
    assert.equal(manifest.shardCount, 2);
    assert.equal(failures[0]?.analysis, 'Domain: Test');
    assert.match(failures[0]?.artifacts?.trace?.href ?? '', /^artifacts\/shard-001\//);
    assert.ok(fs.existsSync(path.join(output, failures[0]!.artifacts!.trace!.href)));
    assert.ok(fs.existsSync(path.join(output, failures[0]!.analysisFile!)));
    assert.equal(fs.readFileSync(path.join(output, failures[0]!.artifacts!.trace!.href), 'utf8'), 'trace');
    assert.doesNotMatch(
        fs.readFileSync(path.join(output, failures[0]!.analysisFile!), 'utf8'),
        new RegExp(analysisSecret),
    );
    assert.match(summary.allTestCases[1]?.artifacts?.screenshot?.href ?? '', /^artifacts\/shard-002\//);
    assert.match(html, /window\.EMBEDDED_TEST_SUMMARY/);
    assert.match(html, /id:failed|&quot;failed&quot;|"failed"/);
    assert.match(html, /<meta name="generated" content="2026-10-16T10:02:00.000Z">/);
    assert.equal(fs.existsSync(path.join(output, 'summary.md')), true);
});

test('accepts legacy summaries without a schema version', () => {
    const first = writeShard('first', [testCase('one', 'expected')], []);
    const second = writeShard('second', [testCase('two', 'expected')], []);
    const file = path.join(first, 'testSummary.json');
    const summary = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    delete summary.schemaVersion;
    fs.writeFileSync(file, JSON.stringify(summary));

    const result = mergeShardReports([first, second], path.join(directory, 'merged'));
    const merged = JSON.parse(fs.readFileSync(result.summaryPath, 'utf8')) as ReportFileSummary;

    assert.equal(merged.schemaVersion, REPORT_SCHEMA_VERSION);
    assert.equal(merged.merge?.sources[0]?.schemaVersion, 0);
});

test('rejects duplicate test identities without creating partial output', () => {
    const first = writeShard('first', [testCase('same', 'expected')], []);
    const second = writeShard('second', [testCase('same', 'expected')], []);
    const output = path.join(directory, 'merged');

    assert.throws(() => mergeShardReports([first, second], output), /Duplicate test identity/);
    assert.equal(fs.existsSync(output), false);
});

test('rejects unsupported schemas and conflicting build identities', () => {
    const unsupported = writeShard('unsupported', [testCase('one', 'expected')], [], {schemaVersion: 99});
    const normal = writeShard('normal', [testCase('two', 'expected')], []);
    assert.throws(
        () => mergeShardReports([unsupported, normal], path.join(directory, 'unsupported-output')),
        /unsupported schema version 99/,
    );

    const different = writeShard('different', [testCase('three', 'expected')], [], {buildId: 'run-99'});
    assert.throws(
        () => mergeShardReports([normal, different], path.join(directory, 'conflict-output')),
        /build metadata conflicts.*buildId/,
    );
});

test('rejects malformed worker timeline data', () => {
    const first = writeShard('first', [testCase('one', 'expected')], []);
    const second = writeShard('second', [testCase('two', 'expected')], []);
    const file = path.join(first, 'testSummary.json');
    const summary = JSON.parse(fs.readFileSync(file, 'utf8')) as ReportFileSummary;
    summary.allTestCases[0]!.attempts![0]!.workerIndex = -1;
    fs.writeFileSync(file, JSON.stringify(summary));

    assert.throws(
        () => mergeShardReports([first, second], path.join(directory, 'invalid-output')),
        /invalid worker index/,
    );

    summary.allTestCases[0]!.attempts![0]!.workerIndex = 0;
    summary.timestamp = 'not-a-date';
    fs.writeFileSync(file, JSON.stringify(summary));
    assert.throws(
        () => mergeShardReports([first, second], path.join(directory, 'invalid-time-output')),
        /invalid "timestamp"/,
    );
});

test('rejects missing artifacts and non-empty output directories', () => {
    const missing = failure('missing', true);
    const first = writeShard('first', [testCase('missing', 'unexpected')], [missing]);
    fs.rmSync(path.join(first, 'raw', 'trace.zip'));
    const second = writeShard('second', [testCase('two', 'expected')], []);

    assert.throws(
        () => mergeShardReports([first, second], path.join(directory, 'missing-output')),
        /Missing trace artifact/,
    );

    const output = path.join(directory, 'occupied');
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'keep.txt'), 'keep');
    assert.throws(() => mergeShardReports([first, second], output), /not empty/);
    assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'keep');
});

test('rejects artifact paths that escape a shard directory', () => {
    const escaped = failure('escaped');
    escaped.artifacts = {
        trace: {href: '../outside-secret.txt', path: 'outside-secret.txt'},
    };
    const first = writeShard('first', [testCase('escaped', 'unexpected')], [escaped]);
    const second = writeShard('second', [testCase('two', 'expected')], []);
    fs.writeFileSync(path.join(directory, 'outside-secret.txt'), 'must not be copied');
    const output = path.join(directory, 'escaped-output');

    assert.throws(() => mergeShardReports([first, second], output), /trace artifact.*escapes shard directory/);
    assert.equal(fs.existsSync(output), false);
});
