/**
 * Interface for database providers for storing test results
 */

import {TestSummary, TestFailure, TestCaseDetails} from '../../types';

export interface TestRun {
    id?: string;
    name: string;
    timestamp: Date;
    environment?: string;
    branch?: string;
    commitHash?: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number;
    metadata?: Record<string, any>;
}

export interface TestResult {
    id?: string;
    testRunId: string;
    testId: string;
    testTitle: string;
    suiteTitle: string;
    status: string;
    duration: number;
    errorMessage?: string;
    errorStack?: string;
    retries?: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface IDatabaseProvider {
    /**
     * Initialize the database connection and schema
     */
    initialize(): Promise<void>;

    /**
     * Close the database connection
     */
    close(): Promise<void>;

    /**
     * Save a test run
     * @param testRun - Test run information
     * @returns ID of the saved test run
     */
    saveTestRun(testRun: TestRun): Promise<string>;

    /**
     * Save a single test result
     * @param result - Test result to save
     * @returns ID of the saved result
     */
    saveTestResult(result: TestResult): Promise<string>;

    /**
     * Save test results for a test run
     * @param testRunId - ID of the test run
     * @param results - Test results to save
     * @returns Number of results saved
     */
    saveTestResults(testRunId: string, results: TestResult[]): Promise<number>;

    /**
     * Get test run by ID
     * @param testRunId - ID of the test run
     * @returns Test run information
     */
    getTestRun(testRunId: string): Promise<TestRun | null>;

    /**
     * Get test results for a test run
     * @param testRunId - ID of the test run
     * @returns Test results
     */
    getTestResults(testRunId: string): Promise<TestResult[]>;

    /**
     * Get test run history
     * @param limit - Maximum number of runs to retrieve
     * @param offset - Offset for pagination
     * @returns List of test runs
     */
    getTestRunHistory(limit?: number, offset?: number): Promise<TestRun[]>;

    /**
     * Get failure trends for a specific test
     * @param testId - Test identifier
     * @param limit - Number of recent runs to analyze
     * @returns Failure statistics
     */
    getTestFailureTrends(
        testId: string,
        limit?: number,
    ): Promise<{
        totalRuns: number;
        failures: number;
        successRate: number;
    }>;
}
