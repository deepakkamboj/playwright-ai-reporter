import {TestResult, Location} from '@playwright/test/reporter';

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
    duration?: number;
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
    errorMessage: string;
    /** Stack trace of the failure */
    errorStack: string;
    /** Time taken by the failed test in seconds */
    duration: number;
    /** Status of the test */
    status?: string;
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
    /** Whether to generate AI-powered fix suggestions for failures */
    generateFix?: boolean;
    /** Whether to automatically create bugs for test failures (requires bug tracker provider) */
    createBug?: boolean;
    /** Whether to automatically generate PRs with fixes (requires generateFix to be true) */
    generatePR?: boolean;
    /** Whether to publish test results to database */
    publishToDB?: boolean;
    /** Whether to send email notifications with the test report */
    sendEmail?: boolean;
}
