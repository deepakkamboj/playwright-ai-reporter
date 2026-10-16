import * as fs from 'fs';
import * as path from 'path';
import {TestFailure, TestCaseDetails, TestSummary} from '../types';
import {redactJson} from './redaction';
import {REPORT_SCHEMA_VERSION} from './reportSchema';

/**
 * Handles writing test results to JSON files.
 *
 * testFailures.json always describes the current run only. It is replaced, never appended to, and
 * holds one entry per failing test: a test that is retried reports its latest failed attempt.
 */
export class FileHandler {
    private readonly failuresFilePath: string;
    private readonly summaryFilePath: string;
    private failures = new Map<string, TestFailure>();
    private writeInterval: NodeJS.Timeout | null = null;
    private isBufferDirty = false;

    /**
     * Creates a new FileHandler instance
     * @param outputDir - Directory where JSON files will be saved
     */
    constructor(outputDir: string = './test-results') {
        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
            console.log(`Created output directory: ${path.resolve(outputDir)}`);
        }

        this.failuresFilePath = path.join(outputDir, 'testFailures.json');
        this.summaryFilePath = path.join(outputDir, 'testSummary.json');

        // A new handler is a new run: start from an empty list instead of the previous run's failures
        fs.writeFileSync(this.failuresFilePath, redactJson([], 2));

        // Setup periodic flushing of the buffer (every 5 seconds)
        this.startPeriodicFlush();
    }

    private static keyOf(failure: TestFailure): string {
        return failure.testId ?? `${failure.testFile ?? ''}::${failure.testTitle}`;
    }

    /**
     * Records a test failure. A later failure of the same test (a retry) replaces the earlier one.
     * @param failure - The test failure to add
     */
    public addFailure(failure: TestFailure): void {
        this.failures.set(FileHandler.keyOf(failure), failure);
        this.isBufferDirty = true;
    }

    /**
     * Writes test summary and all test cases to files
     * @param summary - Test run summary
     * @param allTestCases - All test cases from the run
     */
    public writeSummary(summary: TestSummary, allTestCases: TestCaseDetails[]): void {
        const summaryWithTests = {
            ...summary,
            schemaVersion: REPORT_SCHEMA_VERSION,
            allTestCases,
            timestamp: new Date().toISOString(),
            runEnvironment: summary.buildInfo?.isPipeline ? 'Pipeline' : 'Local',
        };

        fs.writeFileSync(this.summaryFilePath, redactJson(summaryWithTests, 2));
        console.log(`Test summary written to: ${path.resolve(this.summaryFilePath)}`);

        // The summary holds the final, enriched failures (artifacts, analysis, flakiness): use them
        this.failures = new Map(summary.failures.map((failure) => [FileHandler.keyOf(failure), failure]));
        this.isBufferDirty = true;
        this.flushFailures();

        this.dispose();
    }

    /** Stops the periodic flush. Safe to call more than once. */
    public dispose(): void {
        this.stopPeriodicFlush();
    }

    /**
     * Starts the periodic buffer flush
     * @private
     */
    private startPeriodicFlush(): void {
        this.writeInterval = setInterval(() => {
            this.flushFailures();
        }, 5000); // Flush every 5 seconds
        // A pending flush must never keep the Playwright process alive
        this.writeInterval.unref();
    }

    /**
     * Stops the periodic buffer flush
     * @private
     */
    private stopPeriodicFlush(): void {
        if (this.writeInterval) {
            clearInterval(this.writeInterval);
            this.writeInterval = null;
        }
    }

    /**
     * Writes the failures of this run to disk, replacing the file
     * @private
     */
    private flushFailures(): void {
        if (!this.isBufferDirty) return;

        try {
            const failures = Array.from(this.failures.values());
            fs.writeFileSync(this.failuresFilePath, redactJson(failures, 2));
            console.log(
                `Test failures written to: ${path.resolve(this.failuresFilePath)} (${failures.length} total failures)`,
            );
            this.isBufferDirty = false;
        } catch (error) {
            console.error('Error writing failures to file:', error);
        }
    }
}
