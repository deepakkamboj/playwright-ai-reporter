import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    ArtifactLink,
    AttemptSummary,
    BuildInfo,
    TestArtifacts,
    TestCaseDetails,
    TestFailure,
    TrendPoint,
} from '../types';
import {buildSummaryMarkdown} from './summaryMarkdown';
import {redactJson, redactText} from './redaction';
import {
    MergeSource,
    REPORT_SCHEMA_VERSION,
    ReportFileSummary,
    parseReportFailures,
    parseReportSummary,
} from './reportSchema';
import {ReportGenerator} from './reportGenerator';

const SUMMARY_FILE = 'testSummary.json';
const FAILURES_FILE = 'testFailures.json';
const MANIFEST_FILE = 'merge-manifest.json';

interface LoadedShard {
    index: number;
    directory: string;
    name: string;
    summary: ReportFileSummary;
    failures: TestFailure[];
    workerOffset: number;
}

export interface MergeResult {
    outputDir: string;
    reportPath: string;
    summaryPath: string;
    failuresPath: string;
    manifestPath: string;
    testCount: number;
    failureCount: number;
}

export interface MergeManifest {
    schemaVersion: number;
    timestamp: string;
    shardCount: number;
    testCount: number;
    failureCount: number;
    sources: MergeSource[];
}

const isExternal = (value: string): boolean => /^(?:https?:|data:|file:|#)/i.test(value);

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    } catch (error) {
        throw new Error(`Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function testIdentity(
    test: Pick<TestCaseDetails, 'testId' | 'testFile' | 'project' | 'suiteTitle' | 'testTitle'>,
): string {
    return test.testId ? `id:${test.testId}` : `path:${test.testFile ?? ''}::${test.suiteTitle}::${test.testTitle}`;
}

function failureIdentity(failure: TestFailure): string {
    return failure.testId
        ? `id:${failure.testId}`
        : `path:${failure.testFile ?? ''}::::${failure.suiteTitle}::${failure.testTitle}`;
}

function compareIdentity(
    left: Pick<TestCaseDetails, 'testId' | 'testFile' | 'project' | 'suiteTitle' | 'testTitle'>,
    right: Pick<TestCaseDetails, 'testId' | 'testFile' | 'project' | 'suiteTitle' | 'testTitle'>,
): number {
    return testIdentity(left).localeCompare(testIdentity(right));
}

function attemptsOf(value: {attempts?: AttemptSummary[]}): AttemptSummary[] {
    return value.attempts ?? [];
}

function maxWorkerIndex(summary: ReportFileSummary, failures: TestFailure[]): number {
    return [...summary.allTestCases.flatMap(attemptsOf), ...failures.flatMap(attemptsOf)].reduce(
        (maximum, attempt) => Math.max(maximum, attempt.workerIndex ?? -1),
        -1,
    );
}

function offsetAttempts(attempts: AttemptSummary[] | undefined, offset: number): AttemptSummary[] | undefined {
    return attempts?.map((attempt) => ({
        ...attempt,
        ...(attempt.workerIndex !== undefined ? {workerIndex: attempt.workerIndex + offset} : {}),
    }));
}

function safeSegment(value: string): string {
    const readable = value
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return readable || 'test';
}

function shardFile(reference: string, shard: LoadedShard, label: string): string {
    if (path.isAbsolute(reference)) {
        throw new Error(`${label} must use a path relative to shard ${shard.name}`);
    }
    const root = path.resolve(shard.directory);
    const candidate = path.resolve(root, reference);
    const relative = path.relative(root, candidate);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`${label} escapes shard directory ${shard.name}`);
    }
    if (fs.existsSync(candidate)) {
        const realRoot = fs.realpathSync(root);
        const realCandidate = fs.realpathSync(candidate);
        const realRelative = path.relative(realRoot, realCandidate);
        if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
            throw new Error(`${label} escapes shard directory ${shard.name}`);
        }
    }
    return candidate;
}

function copyArtifact(
    link: ArtifactLink,
    kind: string,
    identity: string,
    shard: LoadedShard,
    stagingDir: string,
    outputDir: string,
): ArtifactLink {
    if (isExternal(link.href)) return {...link};

    const source = shardFile(link.href, shard, `${kind} artifact for ${identity}`);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        if (link.inline) return {...link};
        throw new Error(`Missing ${kind} artifact for ${identity}: ${source}`);
    }

    const extension = path.extname(source);
    const hash = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 10);
    const relative = path.join(
        'artifacts',
        `shard-${String(shard.index + 1).padStart(3, '0')}`,
        `${safeSegment(identity)}-${hash}`,
        `${safeSegment(kind)}${extension}`,
    );
    const stagedFile = path.join(stagingDir, relative);
    fs.mkdirSync(path.dirname(stagedFile), {recursive: true});
    fs.copyFileSync(source, stagedFile);

    return {
        href: relative.replace(/\\/g, '/'),
        path: path.relative(process.cwd(), path.join(outputDir, relative)).replace(/\\/g, '/'),
        ...(link.inline ? {inline: link.inline} : {}),
    };
}

function copyArtifacts(
    artifacts: TestArtifacts | undefined,
    identity: string,
    shard: LoadedShard,
    stagingDir: string,
    outputDir: string,
): TestArtifacts | undefined {
    if (!artifacts) return undefined;
    return Object.fromEntries(
        Object.entries(artifacts).map(([kind, link]) => [
            kind,
            copyArtifact(link, kind, identity, shard, stagingDir, outputDir),
        ]),
    ) as TestArtifacts;
}

function copyAnalysisFile(
    analysisFile: string | undefined,
    identity: string,
    shard: LoadedShard,
    stagingDir: string,
    outputDir: string,
): string | undefined {
    if (!analysisFile || isExternal(analysisFile)) return analysisFile;
    const source = shardFile(analysisFile, shard, `AI analysis artifact for ${identity}`);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        throw new Error(`Missing AI analysis artifact for ${identity}: ${source}`);
    }
    const hash = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 10);
    const relative = path.join(
        'artifacts',
        `shard-${String(shard.index + 1).padStart(3, '0')}`,
        `${safeSegment(identity)}-${hash}`,
        `analysis${path.extname(source) || '.md'}`,
    );
    const stagedFile = path.join(stagingDir, relative);
    fs.mkdirSync(path.dirname(stagedFile), {recursive: true});
    fs.writeFileSync(stagedFile, redactText(fs.readFileSync(source, 'utf8')));
    return path.relative(outputDir, path.join(outputDir, relative)).replace(/\\/g, '/');
}

function mergeBuildInfo(shards: LoadedShard[]): BuildInfo | undefined {
    const infos = shards.map((shard) => shard.summary.buildInfo).filter((value): value is BuildInfo => Boolean(value));
    if (infos.length === 0) return undefined;
    if (new Set(infos.map((info) => info.isPipeline)).size > 1) {
        throw new Error('Shard build metadata conflicts for "isPipeline"');
    }

    const identityFields: Array<keyof BuildInfo> = [
        'executionSystem',
        'buildId',
        'buildNumber',
        'buildBranch',
        'buildRepository',
        'commitId',
    ];
    for (const field of identityFields) {
        const values = [...new Set(infos.map((info) => info[field]).filter(Boolean))];
        if (values.length > 1) {
            throw new Error(`Shard build metadata conflicts for "${field}": ${values.join(', ')}`);
        }
    }

    return infos.reduce<BuildInfo>(
        (merged, info) => {
            for (const [key, value] of Object.entries(info)) {
                if (value !== undefined && merged[key as keyof BuildInfo] === undefined) {
                    Object.assign(merged, {[key]: value});
                }
            }
            merged.isPipeline ||= info.isPipeline;
            return merged;
        },
        {isPipeline: false},
    );
}

function commonTrendPrefix(shards: LoadedShard[]): TrendPoint[] {
    const histories = shards.map((shard) => (shard.summary.trend ?? []).slice(0, -1));
    if (histories.length === 0) return [];
    const limit = Math.min(...histories.map((history) => history.length));
    const common: TrendPoint[] = [];
    for (let index = 0; index < limit; index++) {
        const candidate = histories[0][index];
        if (histories.every((history) => JSON.stringify(history[index]) === JSON.stringify(candidate))) {
            common.push(candidate);
        } else {
            break;
        }
    }
    return common;
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(2)}s`;
}

function durationOf(test: TestCaseDetails): number {
    if (test.attempts && test.attempts.length > 0) {
        return test.attempts.reduce((total, attempt) => total + attempt.durationMs / 1000, 0);
    }
    return test.duration ?? 0;
}

function currentTrend(tests: TestCaseDetails[], timestamp: string, buildInfo?: BuildInfo): TrendPoint {
    const point: TrendPoint = {
        time: timestamp,
        ...(buildInfo?.buildId || buildInfo?.buildNumber ? {runId: buildInfo.buildId ?? buildInfo.buildNumber} : {}),
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
    };
    for (const test of tests) {
        if (test.outcome === 'expected') point.passed++;
        else if (test.outcome === 'flaky') point.flaky++;
        else if (test.outcome === 'skipped') point.skipped++;
        else point.failed++;
    }
    return point;
}

function ensureOutputAvailable(outputDir: string): void {
    if (fs.existsSync(outputDir)) {
        if (!fs.statSync(outputDir).isDirectory()) throw new Error(`Output path is not a directory: ${outputDir}`);
        if (fs.readdirSync(outputDir).length > 0) throw new Error(`Output directory is not empty: ${outputDir}`);
        fs.rmdirSync(outputDir);
    }
}

function loadShards(inputDirs: string[]): LoadedShard[] {
    if (inputDirs.length < 2) throw new Error('At least two shard directories are required');

    const directories = inputDirs.map((input) => path.resolve(input)).sort((left, right) => left.localeCompare(right));
    const canonical = (directory: string): string =>
        process.platform === 'win32' ? directory.toLowerCase() : directory;
    if (new Set(directories.map(canonical)).size !== directories.length) {
        throw new Error('Each shard directory must be listed only once');
    }

    let workerOffset = 0;
    return directories.map((directory, index) => {
        if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
            throw new Error(`Shard directory does not exist: ${directory}`);
        }
        const summaryFile = path.join(directory, SUMMARY_FILE);
        const failuresFile = path.join(directory, FAILURES_FILE);
        const summary = parseReportSummary(readJson(summaryFile), summaryFile);
        const failures = parseReportFailures(readJson(failuresFile), failuresFile);
        const summaryFailures = summary.failures.map(failureIdentity).sort();
        const fileFailures = failures.map(failureIdentity).sort();
        if (JSON.stringify(summaryFailures) !== JSON.stringify(fileFailures)) {
            throw new Error(`${summaryFile} and ${failuresFile} describe different failures`);
        }
        const shard: LoadedShard = {
            index,
            directory,
            name: path.basename(directory),
            summary,
            failures,
            workerOffset,
        };
        workerOffset += Math.max(maxWorkerIndex(summary, failures) + 1, 1);
        return shard;
    });
}

export function mergeShardReports(inputDirs: string[], requestedOutputDir: string): MergeResult {
    const outputDir = path.resolve(requestedOutputDir);
    const shards = loadShards(inputDirs);
    const samePath = (left: string, right: string): boolean =>
        process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
    if (shards.some((shard) => samePath(shard.directory, outputDir))) {
        throw new Error('The output directory must be different from every shard directory');
    }
    ensureOutputAvailable(outputDir);

    const stagingDir = path.join(
        path.dirname(outputDir),
        `.${path.basename(outputDir)}.merge-${process.pid}-${Date.now()}`,
    );
    fs.mkdirSync(stagingDir, {recursive: true});

    try {
        const seenTests = new Map<string, string>();
        const seenFailures = new Map<string, string>();
        const tests: TestCaseDetails[] = [];
        const failures: TestFailure[] = [];

        for (const shard of shards) {
            for (const original of shard.summary.allTestCases) {
                const identity = testIdentity(original);
                const previous = seenTests.get(identity);
                if (previous) throw new Error(`Duplicate test identity "${identity}" in ${previous} and ${shard.name}`);
                seenTests.set(identity, shard.name);
                tests.push({
                    ...original,
                    attempts: offsetAttempts(original.attempts, shard.workerOffset),
                    artifacts: copyArtifacts(original.artifacts, identity, shard, stagingDir, outputDir),
                });
            }
            for (const original of shard.failures) {
                const identity = failureIdentity(original);
                const previous = seenFailures.get(identity);
                if (previous) {
                    throw new Error(`Duplicate failure identity "${identity}" in ${previous} and ${shard.name}`);
                }
                if (!seenTests.has(identity)) {
                    throw new Error(`Failure "${identity}" in ${shard.name} has no matching test case`);
                }
                seenFailures.set(identity, shard.name);
                failures.push({
                    ...original,
                    attempts: offsetAttempts(original.attempts, shard.workerOffset),
                    artifacts: copyArtifacts(original.artifacts, identity, shard, stagingDir, outputDir),
                    analysisFile: copyAnalysisFile(original.analysisFile, identity, shard, stagingDir, outputDir),
                });
            }
        }

        tests.sort(compareIdentity);
        failures.sort((left, right) => failureIdentity(left).localeCompare(failureIdentity(right)));
        const expectedFailures = tests
            .filter((test) => test.outcome !== 'expected' && test.outcome !== 'flaky' && test.outcome !== 'skipped')
            .map(testIdentity)
            .sort();
        const actualFailures = failures.map(failureIdentity).sort();
        if (JSON.stringify(expectedFailures) !== JSON.stringify(actualFailures)) {
            throw new Error('Merged test outcomes and failure records do not match');
        }

        const timestamp = shards
            .map((shard) => shard.summary.timestamp)
            .sort((left, right) => left.localeCompare(right))
            .at(-1)!;
        const buildInfo = mergeBuildInfo(shards);
        const passed = tests.filter((test) => test.outcome === 'expected' || test.outcome === 'flaky');
        const skippedCount = tests.filter((test) => test.outcome === 'skipped').length;
        const failedCount = failures.length;
        const durations = tests.map((test) => ({testTitle: test.testTitle, duration: durationOf(test)}));
        const passedDurations = passed.map((test) => ({testTitle: test.testTitle, duration: durationOf(test)}));
        const slowestTests = [...passedDurations].sort((left, right) => right.duration - left.duration).slice(0, 3);
        const sources: MergeSource[] = shards.map((shard) => ({
            name: shard.name,
            schemaVersion: shard.summary.schemaVersion,
            testCount: shard.summary.allTestCases.length,
            timestamp: shard.summary.timestamp,
            ...(shard.summary.reportSettings ? {reportSettings: shard.summary.reportSettings} : {}),
        }));
        const environments = [...new Set(shards.map((shard) => shard.summary.runEnvironment))];
        const trend = [...commonTrendPrefix(shards), currentTrend(tests, timestamp, buildInfo)].slice(-30);

        const summary: ReportFileSummary = {
            schemaVersion: REPORT_SCHEMA_VERSION,
            failures,
            testCount: tests.length,
            passedCount: passed.length,
            skippedCount,
            failedCount,
            totalTimeDisplay: formatDuration(durations.reduce((total, test) => total + test.duration, 0)),
            averageTime:
                passed.length > 0 ? passed.reduce((total, test) => total + durationOf(test), 0) / passed.length : 0,
            slowestTest: slowestTests[0]?.duration ?? 0,
            slowestTests,
            ...(buildInfo ? {buildInfo} : {}),
            trend,
            allTestCases: tests,
            timestamp,
            runEnvironment: environments.length === 1 ? environments[0] : 'Merged',
            merge: {shardCount: shards.length, sources},
        };
        const manifest: MergeManifest = {
            schemaVersion: REPORT_SCHEMA_VERSION,
            timestamp,
            shardCount: shards.length,
            testCount: tests.length,
            failureCount: failures.length,
            sources,
        };

        fs.writeFileSync(path.join(stagingDir, SUMMARY_FILE), redactJson(summary, 2));
        fs.writeFileSync(path.join(stagingDir, FAILURES_FILE), redactJson(failures, 2));
        fs.writeFileSync(path.join(stagingDir, MANIFEST_FILE), redactJson(manifest, 2));
        fs.writeFileSync(
            path.join(stagingDir, 'summary.md'),
            redactText(buildSummaryMarkdown(summary, tests, 'test-health-report.html')),
        );
        const stagedReport = new ReportGenerator(stagingDir, 'test-health-report.html', timestamp).generateReport();

        fs.renameSync(stagingDir, outputDir);
        return {
            outputDir,
            reportPath: path.join(outputDir, path.basename(stagedReport)),
            summaryPath: path.join(outputDir, SUMMARY_FILE),
            failuresPath: path.join(outputDir, FAILURES_FILE),
            manifestPath: path.join(outputDir, MANIFEST_FILE),
            testCount: tests.length,
            failureCount: failures.length,
        };
    } catch (error) {
        fs.rmSync(stagingDir, {recursive: true, force: true});
        throw error;
    }
}
