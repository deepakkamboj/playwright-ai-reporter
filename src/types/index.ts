import {TestResult, Location} from '@playwright/test/reporter';

/** A file Playwright attached to a test result (screenshot, video, trace, ...). */
export interface AttachmentRef {
    name: string;
    contentType: string;
    /** Absolute path of the file on disk, when the attachment is a file. */
    path?: string;
    /** Content, kept only for metadata and API-call attachments (see isRecordedAttachment). */
    body?: string;
}

/** Facts a test declares about itself, such as priority, severity, owner and feature. */
export type TestMetadata = Record<string, unknown>;

/** One API call a test made, as recorded by recordApi(). Secrets are already masked. */
export interface ApiCall {
    method: string;
    url: string;
    /** HTTP status, or 0 when the request never got a response. */
    status: number;
    durationMs: number;
    /** Set when the request failed before a response, for example a network error. */
    failure?: string;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
}

/**
 * Represents information about a single test attempt.
 * This includes the test status, duration, and any errors that occurred.
 */
export interface AttemptInfo {
    /** The final status of the test attempt (passed, failed, skipped, etc.) */
    status: TestResult['status'];
    /** Duration of the test attempt in seconds */
    duration: number;
    /** Array of errors that occurred during the test attempt */
    errors: TestError[];
    /** Zero-based retry number of this attempt. */
    retry?: number;
    /** ISO time the attempt started, and the worker that ran it. */
    startTime?: string;
    workerIndex?: number;
    /** Files attached to this attempt. */
    attachments?: AttachmentRef[];
}

/** A link to an artifact file, usable from the report and from a terminal. */
export interface ArtifactLink {
    /** Path relative to the report file, with forward slashes. Use it in href and src. */
    href: string;
    /** Path relative to the working directory, for terminal commands such as show-trace. */
    path: string;
    /** For small screenshots: the image itself as a data URI, added when the report is generated. */
    inline?: string;
}

export interface TestArtifacts {
    screenshot?: ArtifactLink;
    video?: ArtifactLink;
    trace?: ArtifactLink;
    errorContext?: ArtifactLink;
}

/** One attempt, reduced to what the report shows. */
export interface AttemptSummary {
    retry: number;
    status: string;
    durationMs: number;
    /** ISO time the attempt started, and the worker that ran it. */
    startTime?: string;
    workerIndex?: number;
    error?: string;
    /** Short label for the kind of error: timing, network, selector, assertion, ... */
    kind?: string;
}

export type FlakinessVerdict = 'flaky' | 'consistent-failure' | 'new-failure' | 'stable';

/** Why a test is or is not considered flaky, from this run and the recorded history. */
export interface FlakinessReport {
    verdict: FlakinessVerdict;
    /** Percentage of runs (history plus this run) that did not pass first time. */
    failureRate: number;
    /** Number of runs the rate is based on, including this one. */
    runs: number;
    /** Distinct error kinds seen, most common first. */
    patterns: string[];
    /** The most common error kind, or 'Intermittent' when there is no error to classify. */
    primaryPattern: string;
    /** Facts the verdict is based on, for example "failed then passed on retry 1". */
    evidence: string[];
    /** The safest next action for this pattern. */
    recommendation: string;
}

/**
 * Represents an error that occurred during test execution.
 */
export interface TestError {
    /** The error message */
    message: string;
    /** Optional stack trace of the error */
    stack?: string;
}

/**
 * Enhanced representation of a TestCase with additional metadata.
 * Uses composition instead of extension to avoid type conflicts.
 */
export interface TestCaseDetails {
    testId?: string;
    /** Title of the test case */
    testTitle: string;
    /** Title of the test suite containing this test */
    suiteTitle: string;
    /** File path of the test file */
    testFile?: string;
    /** Location information of the test in the source code */
    location?: Location;
    status?: string;
    outcome?: string;
    owningTeam?: string;
    /** Playwright project (browser or device) the test ran in. */
    project?: string;
    /** Declared by the test through a "meta" attachment: priority, severity, owner, feature, ... */
    meta?: TestMetadata;
    /** API calls recorded in the attempt worth investigating (see recordApi). */
    apiCalls?: ApiCall[];
    duration?: number;
    /** Number of retries that ran (attempts minus one). */
    retryCount?: number;
    attempts?: AttemptSummary[];
    /** Artifacts of the attempt worth looking at: the last failed one. */
    artifacts?: TestArtifacts;
    flakiness?: FlakinessReport;
}

/**
 * Represents a complete record of a test case and all its attempts.
 * This is used to track retries and maintain test history.
 */
export interface TestRecord {
    /** The test case being tracked */
    test: TestCaseDetails;
    /** Array of all attempts made to run this test */
    attempts: AttemptInfo[];
}

/**
 * Represents a complete summary of the test run results.
 * This includes statistics about passed, failed, and skipped tests,
 * as well as timing information.
 */
export interface TestSummary {
    /** Array of test failures with detailed information */
    failures: TestFailure[];
    /** Total number of tests executed */
    testCount: number;
    /** Number of tests that passed */
    passedCount: number;
    /** Number of tests that were skipped */
    skippedCount: number;
    /** Number of tests that failed */
    failedCount: number;
    /** Formatted string of total test execution time */
    totalTimeDisplay: string;
    /** Average time taken by passed tests */
    averageTime: number;
    /** Duration of the slowest test in seconds */
    slowestTest: number;
    /** Array of the slowest tests with their durations */
    slowestTests: SlowTest[];
    /** Information about the build environment */
    buildInfo?: BuildInfo;
    /** Results of the recent runs, oldest first, ending with this run. Empty when history is off. */
    trend?: TrendPoint[];
}

/** How one earlier run ended, in counts of tests. */
export interface TrendPoint {
    /** ISO timestamp of the run. */
    time: string;
    runId?: string;
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
}

/**
 * Represents information about the build environment
 */
export interface BuildInfo {
    /** Whether the test was run in a CI environment */
    isPipeline: boolean;
    /** Name of the CI system (Azure Pipelines, GitHub Actions, etc.) */
    executionSystem?: string;
    /** Link to build artifacts */
    artifactsLink?: string;
    /** Link to build results */
    buildLink?: string;
    /** Build identifier */
    buildId?: string;
    /** Build number */
    buildNumber?: string;
    /** Branch name */
    buildBranch?: string;
    /** Repository name */
    buildRepository?: string;
    /** Commit identifier */
    commitId?: string;
    /** Link to commit */
    commitLink?: string;
    /** Link to test results */
    testLink?: string;
}

/**
 * Represents detailed information about a test failure.
 */
export interface TestFailure {
    testId?: string;
    /** Title of the failed test */
    testTitle: string;
    /** Title of the test suite containing this test */
    suiteTitle: string;
    /** Error message from the failure */
    owningTeam: string;
    /** Declared by the test through a "meta" attachment: priority, severity, owner, feature, ... */
    meta?: TestMetadata;
    apiCalls?: ApiCall[];
    errorMessage: string;
    /** Stack trace of the failure */
    errorStack: string;
    /** Time taken by the failed test in seconds */
    duration: number;
    /** Status of the test */
    status?: string;
    /** Number of retries that ran before this final failure. */
    retryCount?: number;
    attempts?: AttemptSummary[];
    artifacts?: TestArtifacts;
    flakiness?: FlakinessReport;
    /** AI root-cause analysis, when generateFix is on and a provider answered. */
    analysis?: string;
    /** The saved AI response, relative to the report file. */
    analysisFile?: string;
    /** True when the AI also proposed a corrected file that passed the safety checks. */
    fixAccepted?: boolean;
    /** URL of the pull request that was opened for this failure, when generatePR is on. */
    pullRequestUrl?: string;
    /** Whether the failure was due to a timeout */
    isTimeout: boolean;
    /** Category of the error (ElementNotFound, Timeout/DelayedElement, SelectorChanged, etc.) */
    errorCategory: string;
    /** File path of the test file */
    testFile?: string;
    /** Location information of the test in the source code */
    location?: Location;
}

/**
 * Represents information about a slow test.
 * Used for reporting tests that took longer than expected.
 */
export interface SlowTest {
    /** Title of the slow test */
    testTitle: string;
    /** Duration of the test in seconds */
    duration: number;
}

/**
 * Configuration options for the custom reporter.
 * All fields are optional and have default values.
 */
export interface ReporterConfig {
    /** Threshold in seconds after which a test is considered slow */
    slowTestThreshold?: number;
    /** Maximum number of slow tests to show in the report */
    maxSlowTestsToShow?: number;
    /** Threshold in seconds after which to show a timeout warning */
    timeoutWarningThreshold?: number;
    /** Whether to show stack traces in error reports */
    showStackTrace?: boolean;
    /** Directory where JSON output files will be saved */
    outputDir?: string;
    /**
     * File that remembers the last 30 runs so flaky tests can be recognised across runs.
     * Defaults to history.json inside outputDir. Playwright empties its own outputDir before every
     * run, so point this outside it (for example test-results/history.json) to keep history locally,
     * and cache the file between runs in CI.
     */
    historyFile?: string;
    /**
     * Read custom `@key value` tags from the adjacent JSDoc block above each test.
     * Disabled by default. Metadata attached with meta() overrides comment values.
     */
    commentMetadata?: boolean;
    /** Whether to generate AI-powered fix suggestions for failures */
    generateFix?: boolean;
    /** Whether to automatically create bugs for test failures (requires bug tracker provider) */
    createBug?: boolean;
    /**
     * Whether to close open test-failure bugs whose test passed in this run (requires bug tracker
     * provider). Enable it only on the branch that ships fixes, never on pull request runs.
     */
    closeFixedBugs?: boolean;
    /** Whether to automatically generate PRs with fixes (requires generateFix to be true) */
    generatePR?: boolean;
    /** Whether to publish test results to database */
    publishToDB?: boolean;
    /** Whether to send email notifications with the test report */
    sendEmail?: boolean;
}
