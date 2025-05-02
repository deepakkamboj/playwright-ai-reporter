import * as fs from 'fs';
import * as path from 'path';
import {TestFailure} from '../types';

/**
 * Interface for the last run information
 */
interface LastRunInfo {
    status: string;
    failedTests: string[];
}

/**
 * Interface for test failure history item
 */
interface TestFailureHistory extends TestFailure {
    timestamp?: string;
}

/**
 * Utility functions for working with test history
 */
export class HistoryUtils {
    /**
     * Retrieves information about the last test run
     * @param outputDir - Directory where test results are stored
     * @returns Information about the last test run, or null if not available
     */
    static getLastRunInfo(outputDir: string = './test-results'): LastRunInfo | null {
        try {
            const lastRunFilePath = path.join(outputDir, '.last-run.json');
            if (!fs.existsSync(lastRunFilePath)) {
                return null;
            }

            const content = fs.readFileSync(lastRunFilePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading last run information:', error);
            return null;
        }
    }

    /**
     * Checks if a particular test was failing in the previous run
     * @param testId - ID of the test to check
     * @param outputDir - Directory where test results are stored
     * @returns True if the test was failing in the previous run, false otherwise
     */
    static wasTestFailingPreviously(testId: string, outputDir: string = './test-results'): boolean {
        const lastRunInfo = this.getLastRunInfo(outputDir);
        if (!lastRunInfo) {
            return false;
        }

        return lastRunInfo.failedTests.includes(testId);
    }

    /**
     * Compares current test failures with previous run failures to identify new and fixed tests
     * @param currentFailures - List of currently failed test IDs
     * @param outputDir - Directory where test results are stored
     * @returns Object with lists of newly failing and fixed tests
     */
    static compareWithPreviousRun(
        currentFailures: string[],
        outputDir: string = './test-results',
    ): {
        newlyFailing: string[];
        fixed: string[];
    } {
        const lastRunInfo = this.getLastRunInfo(outputDir);

        if (!lastRunInfo) {
            // No previous run data available, all current failures are new
            return {
                newlyFailing: currentFailures,
                fixed: [],
            };
        }

        const previousFailures = lastRunInfo.failedTests || [];

        return {
            // Tests failing now but not in previous run
            newlyFailing: currentFailures.filter((id) => !previousFailures.includes(id)),
            // Tests that were failing before but now passing
            fixed: previousFailures.filter((id) => !currentFailures.includes(id)),
        };
    }

    /**
     * Gets the full test failure history
     * @param outputDir - Directory where test results are stored
     * @returns Array of test failures with timestamps
     */
    static getTestFailureHistory(outputDir: string = './test-results'): TestFailureHistory[] {
        try {
            const failuresFilePath = path.join(outputDir, 'testFailures.json');
            if (!fs.existsSync(failuresFilePath)) {
                return [];
            }

            const content = fs.readFileSync(failuresFilePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading test failure history:', error);
            return [];
        }
    }
}
