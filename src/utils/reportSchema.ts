import {ReportSettings, TestCaseDetails, TestFailure, TestSummary} from '../types';

export const REPORT_SCHEMA_VERSION = 1;

export interface MergeSource {
    name: string;
    schemaVersion: number;
    testCount: number;
    timestamp: string;
    reportSettings?: ReportSettings;
}

export interface MergeMetadata {
    shardCount: number;
    sources: MergeSource[];
}

/** JSON contract written to testSummary.json and consumed by the merge CLI. */
export interface ReportFileSummary extends TestSummary {
    schemaVersion: number;
    allTestCases: TestCaseDetails[];
    timestamp: string;
    runEnvironment: string;
    merge?: MergeMetadata;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function requiredString(value: JsonObject, key: string, source: string): string {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
        throw new Error(`${source} has an invalid or missing "${key}"`);
    }
    return value[key] as string;
}

function validateAttempts(value: JsonObject, source: string): void {
    if (value.attempts === undefined) return;
    if (!Array.isArray(value.attempts)) throw new Error(`${source} has invalid "attempts"`);
    value.attempts.forEach((attempt, index) => {
        const label = `${source} attempt ${index + 1}`;
        if (!isObject(attempt)) throw new Error(`${label} is not an object`);
        requiredString(attempt, 'status', label);
        if (!Number.isInteger(attempt.retry) || typeof attempt.durationMs !== 'number') {
            throw new Error(`${label} has an invalid retry or duration`);
        }
        if (
            attempt.workerIndex !== undefined &&
            (!Number.isInteger(attempt.workerIndex) || (attempt.workerIndex as number) < 0)
        ) {
            throw new Error(`${label} has an invalid worker index`);
        }
        if (attempt.startTime !== undefined && typeof attempt.startTime !== 'string') {
            throw new Error(`${label} has an invalid start time`);
        }
    });
}

function validateArtifacts(value: JsonObject, source: string): void {
    if (value.artifacts === undefined) return;
    if (!isObject(value.artifacts)) throw new Error(`${source} has invalid "artifacts"`);
    for (const [kind, artifact] of Object.entries(value.artifacts)) {
        if (!isObject(artifact) || typeof artifact.href !== 'string' || typeof artifact.path !== 'string') {
            throw new Error(`${source} has an invalid "${kind}" artifact`);
        }
        if (artifact.inline !== undefined && typeof artifact.inline !== 'string') {
            throw new Error(`${source} has an invalid inline "${kind}" artifact`);
        }
    }
}

function validateTest(value: unknown, source: string): asserts value is TestCaseDetails {
    if (!isObject(value)) throw new Error(`${source} contains a test that is not an object`);
    requiredString(value, 'testTitle', source);
    requiredString(value, 'suiteTitle', source);
    requiredString(value, 'outcome', source);
    validateAttempts(value, source);
    validateArtifacts(value, source);
}

function validateFailure(value: unknown, source: string): asserts value is TestFailure {
    if (!isObject(value)) throw new Error(`${source} contains a failure that is not an object`);
    for (const key of ['testTitle', 'suiteTitle', 'errorMessage', 'owningTeam', 'errorCategory']) {
        requiredString(value, key, source);
    }
    if (typeof value.errorStack !== 'string') throw new Error(`${source} has an invalid or missing "errorStack"`);
    if (typeof value.duration !== 'number' || typeof value.isTimeout !== 'boolean') {
        throw new Error(`${source} contains a failure with invalid duration or timeout data`);
    }
    validateAttempts(value, source);
    validateArtifacts(value, source);
    if (value.analysisFile !== undefined && typeof value.analysisFile !== 'string') {
        throw new Error(`${source} has an invalid "analysisFile"`);
    }
}

export function parseReportSummary(value: unknown, source: string): ReportFileSummary {
    if (!isObject(value)) throw new Error(`${source} must contain a JSON object`);

    const schemaVersion = value.schemaVersion === undefined ? 0 : value.schemaVersion;
    if (!Number.isInteger(schemaVersion) || (schemaVersion !== 0 && schemaVersion !== REPORT_SCHEMA_VERSION)) {
        throw new Error(
            `${source} uses unsupported schema version ${String(schemaVersion)}; supported versions are legacy and ${REPORT_SCHEMA_VERSION}`,
        );
    }
    if (!Array.isArray(value.allTestCases)) {
        throw new Error(`${source} has an invalid or missing "allTestCases" array`);
    }
    value.allTestCases.forEach((test, index) => validateTest(test, `${source} test ${index + 1}`));
    if (!Array.isArray(value.failures)) {
        throw new Error(`${source} has an invalid or missing "failures" array`);
    }
    value.failures.forEach((failure, index) => validateFailure(failure, `${source} failure ${index + 1}`));
    const timestamp = requiredString(value, 'timestamp', source);
    if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${source} has an invalid "timestamp"`);
    requiredString(value, 'runEnvironment', source);
    if (value.buildInfo !== undefined) {
        if (!isObject(value.buildInfo) || typeof value.buildInfo.isPipeline !== 'boolean') {
            throw new Error(`${source} has invalid "buildInfo"`);
        }
    }
    if (value.trend !== undefined) {
        if (!Array.isArray(value.trend)) throw new Error(`${source} has invalid "trend"`);
        value.trend.forEach((point, index) => {
            if (
                !isObject(point) ||
                typeof point.time !== 'string' ||
                Number.isNaN(Date.parse(point.time)) ||
                !['passed', 'failed', 'flaky', 'skipped'].every((key) => typeof point[key] === 'number')
            ) {
                throw new Error(`${source} has invalid trend point ${index + 1}`);
            }
        });
    }

    return {...value, schemaVersion} as unknown as ReportFileSummary;
}

export function parseReportFailures(value: unknown, source: string): TestFailure[] {
    const failures = Array.isArray(value)
        ? value
        : isObject(value) && Array.isArray(value.failures)
          ? value.failures
          : null;
    if (!failures) throw new Error(`${source} must contain an array of failures`);
    failures.forEach((failure, index) => validateFailure(failure, `${source} failure ${index + 1}`));
    return failures;
}
