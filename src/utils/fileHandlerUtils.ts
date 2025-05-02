import * as fs from 'fs';
import * as path from 'path';
import {TestFailure, TestCaseDetails, TestSummary} from '../types';

/**
 * Handles writing test results to JSON files
 */
export class FileHandler {
    private readonly failuresFilePath: string;
    private readonly summaryFilePath: string;
    private failuresBuffer: TestFailure[] = [];
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
        }

        this.failuresFilePath = path.join(outputDir, 'testFailures.json');
        this.summaryFilePath = path.join(outputDir, 'testSummary.json');

        // Initialize failures file with empty array if it doesn't exist
        if (!fs.existsSync(this.failuresFilePath)) {
            fs.writeFileSync(this.failuresFilePath, JSON.stringify([], null, 2));
        }

        // Setup periodic flushing of the buffer (every 5 seconds)
        this.startPeriodicFlush();
    }

    /**
     * Adds a test failure to the failures file
     * @param failure - The test failure to add
     */
    public addFailure(failure: TestFailure): void {
        this.failuresBuffer.push(failure);
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
            allTestCases,
            timestamp: new Date().toISOString(),
            runEnvironment: summary.buildInfo?.isPipeline ? 'Pipeline' : 'Local',
        };

        fs.writeFileSync(this.summaryFilePath, JSON.stringify(summaryWithTests, null, 2));

        // Final flush of failures buffer
        this.flushFailuresBuffer();

        // Stop the periodic flush
        this.stopPeriodicFlush();
    }

    /**
     * Starts the periodic buffer flush
     * @private
     */
    private startPeriodicFlush(): void {
        this.writeInterval = setInterval(() => {
            this.flushFailuresBuffer();
        }, 5000); // Flush every 5 seconds
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
     * Flushes the failures buffer to disk
     * @private
     */
    private flushFailuresBuffer(): void {
        if (!this.isBufferDirty) return;

        try {
            // Read existing failures
            let existingFailures: TestFailure[] = [];
            if (fs.existsSync(this.failuresFilePath)) {
                const content = fs.readFileSync(this.failuresFilePath, 'utf8');
                existingFailures = JSON.parse(content);
            }

            // Append new failures
            const allFailures = [...existingFailures, ...this.failuresBuffer];

            // Write back to file
            fs.writeFileSync(this.failuresFilePath, JSON.stringify(allFailures, null, 2));

            // Clear buffer
            this.failuresBuffer = [];
            this.isBufferDirty = false;
        } catch (error) {
            console.error('Error writing failures to file:', error);
        }
    }
}
