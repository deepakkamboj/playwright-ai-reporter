import {Reporter, TestCase, TestResult, FullConfig, Suite} from '@playwright/test/reporter';
import {colors} from './colors';
import {TestRecord, ReporterConfig, TestSummary, TestCaseDetails, TestFailure} from './types';
import {TestUtils, Logger} from './utils/utils';
import {FileHandler} from './utils/fileHandlerUtils';
import {BuildInfoUtils} from './utils/buildInfoUtils';
import {GenAIUtils} from './utils/genaiUtils';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PlaywrightTestReporter is a modern, maintainable reporter for Playwright tests.
 * It provides detailed, colorized output of test results with comprehensive metrics
 * and configurable options for better visibility into test execution.
 *
 * Features:
 * - Colorized output for different test states (passed, failed, skipped, retried)
 * - Detailed metrics including test duration and slow test identification
 * - Configurable thresholds for slow tests and timeouts
 * - Comprehensive error reporting with stack traces
 * - Support for test retries with clear status indication
 * - Complete monitoring of all error types including setup/teardown errors
 * - JSON output files for CI integration and historical tracking
 */
export default class PlaywrightTestReporter implements Reporter {
    private suite!: Suite;
    private outputDir!: string;
    private readonly _testRecords = new Map<string, TestRecord>();
    private _startTime: number = 0;
    private readonly _config: Required<ReporterConfig>;
    private _nonTestErrors: Error[] = [];
    private _hasInterruptedTests: boolean = false;
    private _fileHandler: FileHandler;

    /**
     * Creates a new instance of the PlaywrightTestReporter.
     *
     * @param config - Optional configuration object to customize reporter behavior
     */
    constructor(config: ReporterConfig = {}) {
        this._config = {
            slowTestThreshold: config.slowTestThreshold ?? 5,
            maxSlowTestsToShow: config.maxSlowTestsToShow ?? 3,
            timeoutWarningThreshold: config.timeoutWarningThreshold ?? 30,
            showStackTrace: config.showStackTrace ?? true,
            outputDir: config.outputDir ?? './test-results',
            generateFix: config.generateFix ?? false,
        };

        this.outputDir = this._config.outputDir;
        this._fileHandler = new FileHandler(this.outputDir);
    }

    /**
     * Called when the test run begins.
     * Initializes the start time and displays a start message.
     *
     * @param config - The full Playwright configuration
     * @param suite - The root test suite
     */
    public onBegin(config: FullConfig, suite: Suite): void {
        this.suite = suite;
        const totalTestCount = this._countTests(suite);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(
            `${colors.fgMagentaBright}🚀 Starting test run: ${totalTestCount} tests using ${config.workers} workers${colors.reset}`,
        );
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}Test run started at: ${new Date().toLocaleString()}${colors.reset}`);

        // Get project name(s) from configuration
        const projectNames = config.projects?.map(project => project.name).filter(Boolean).join(', ') || 'Default Project';
        
        console.log(`
            Playwright Test Configuration:
            Project Names: ${projectNames}
            Generate Fix: ${this._config.generateFix}
            Output Directory: ${this.outputDir}
            Workers: ${config.workers}           
        `);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log('\n');
        this._startTime = Date.now();

        // Use the output directory from reporter config
        // The outputDir is already set in the constructor, so we don't need to reset it here
        // unless there's a specific override in the config

        // If a project-specific output directory is set, use that instead
        if (config.projects && config.projects.length > 0) {
            // Try to find an output directory in any project config
            for (const project of config.projects) {
                if (project.outputDir) {
                    this.outputDir = path.resolve(project.outputDir);
                    this._fileHandler = new FileHandler(this.outputDir);
                    break;
                }
            }
        }
    }

    /**
     * Recursively counts the total number of tests in a suite and its children
     *
     * @param suite - The test suite to count tests from
     * @returns The total number of tests
     * @private
     */
    private _countTests(suite: Suite): number {
        let count = suite.tests.length;
        for (const childSuite of suite.suites) {
            count += this._countTests(childSuite);
        }
        return count;
    }

    /**
     * Called when an error occurs during test setup or teardown.
     * Logs the error with optional stack trace based on configuration.
     * Now tracks errors to ensure they affect final exit code.
     *
     * @param error - The error that occurred
     */
    public onError(error: Error): void {
        console.error(`${colors.fgRed}❌ Setup or runtime error: ${error.message}${colors.reset}`);
        if (error.stack && this._config.showStackTrace) {
            console.error(`${colors.fgRed}${error.stack}${colors.reset}`);
        }

        // Track non-test errors to include in final reporting
        this._nonTestErrors.push(error);
    }

    /**
     * Called when a test completes (whether passed, failed, or skipped).
     * Records the test result and logs appropriate output based on the test status.
     * Now tracks all test statuses including interrupted ones.
     *
     * @param test - The test case that completed
     * @param result - The result of the test execution
     */
    public onTestEnd(test: TestCase, result: TestResult): void {
        const title = test.title;
        const timeTakenSec = result.duration / 1000;

        // Initialize test record if first attempt
        if (!this._testRecords.has(title)) {
            // Create an enhanced test case with required properties
            const testCaseDetails: TestCaseDetails = {
                testId: test.id,
                testTitle: test.title,
                suiteTitle: test.parent?.title || 'Unknown Suite',
                testFile: test.location?.file,
                location: test.location,
                outcome: test.outcome(),
                status: TestUtils.outcomeToStatus(test.outcome()),
                owningTeam: TestUtils.getOwningTeam(test),
            };

            this._testRecords.set(title, {
                test: testCaseDetails,
                attempts: [],
            });
        }

        // Update test record with new attempt
        const testRecord = this._testRecords.get(title);
        if (testRecord) {
            // Fix: Added null check instead of non-null assertion
            testRecord.attempts.push({
                status: result.status,
                duration: timeTakenSec,
                errors: result.errors.map((e) => ({
                    message: e.message || 'No error message',
                    stack: e.stack,
                })),
            });
        }

        // Add failures to the FileHandler
        if (result.status === 'failed' || result.status === 'timedOut') {
            const errorMessage = result.errors[0]?.message || 'Unknown error';
            const errorCategory = TestUtils.categorizeError(errorMessage);

            this._fileHandler.addFailure({
                testId: test.id,
                testTitle: test.title,
                suiteTitle: test.parent?.title || 'Unknown Suite',
                errorMessage: errorMessage,
                errorStack: result.errors[0]?.stack || '',
                duration: timeTakenSec,
                owningTeam: TestUtils.getOwningTeam(test),
                isTimeout: result.status === 'timedOut',
                errorCategory,
                testFile: test.location?.file,
                location: test.location,
            });
        }

        // Track interrupted tests specifically
        if (result.status === 'interrupted') {
            this._hasInterruptedTests = true;
        }

        // Log test outcome with appropriate formatting
        this._logTestOutcome(test.title, result, timeTakenSec);
    }

    /**
     * Called when all tests have completed.
     * Processes results, displays summary statistics, and sets appropriate exit code.
     * Now properly handles all error conditions including non-test errors.
     */
    public async onEnd(): Promise<void> {
        const endTime = Date.now();
        const totalTimeSec = (endTime - this._startTime) / 1000;
        const totalTimeDisplay = TestUtils.formatTime(totalTimeSec);

        // Process results
        const {passedCount, testCount, skippedCount, failures, passedDurations} = TestUtils.processTestResults(
            this._testRecords,
        );

        // Handle no tests case
        if (testCount === 0) {
            console.log(`${colors.fgRed}❌ No tests found${colors.reset}`);
            this._exitWithError();
            return;
        }

        // Gather build information
        const buildInfo = BuildInfoUtils.getBuildInfo();

        // Compute metrics
        const summary: TestSummary = {
            failures,
            testCount,
            passedCount,
            skippedCount,
            failedCount: testCount - passedCount - skippedCount,
            totalTimeDisplay,
            averageTime: TestUtils.calculateAverageTime(passedDurations),
            slowestTest: Math.max(...passedDurations, 0),
            slowestTests: TestUtils.findSlowestTests(this._testRecords, this._config.maxSlowTestsToShow),
            buildInfo,
        };

        // Generate fix suggestions if enabled
        if (this._config.generateFix && failures.length > 0) {
            await this._generateFixSuggestions(failures);
        }

        // Log results
        Logger.logSummary(summary);

        // Report non-test errors
        if (this._nonTestErrors.length > 0) {
            console.log(`${colors.fgRed}\nSetup or Teardown Errors:${colors.reset}`);
            this._nonTestErrors.forEach((error, index) => {
                console.log(`${colors.fgRed}Error #${index + 1}: ${error.message}${colors.reset}`);
                if (error.stack && this._config.showStackTrace) {
                    console.log(`${colors.fgRed}${error.stack}${colors.reset}`);
                }
            });
        }

        // Report test failures
        if (failures.length > 0) {
            Logger.logFailures(failures);
        }

        // Extract all test case details for summary
        const allTestCases: TestCaseDetails[] = Array.from(this._testRecords.values()).map((record) => record.test);

        // Write summary and test details to JSON
        this._fileHandler.writeSummary(summary, allTestCases);

        // Record last run status in a separate file
        this.saveLastRunStatus(failures.length > 0);

        // Handle interrupted tests
        if (this._hasInterruptedTests) {
            console.log(
                `${colors.fgRed}\n⚠️ Some tests were interrupted. This may indicate a test hang or timeout.${colors.reset}`,
            );
        }

        // Determine exit status (any errors should cause a non-zero exit)
        const hasErrors = failures.length > 0 || this._nonTestErrors.length > 0 || this._hasInterruptedTests;

        if (hasErrors) {
            this._exitWithError();
        } else {
            this._exitWithSuccess();
        }
    }

    /**
     * Exits the process with a success code.
     * Extracted to a method to make the flow clearer and more maintainable.
     * @private
     */
    private _exitWithSuccess(): void {
        process.exitCode = 0;
    }

    /**
     * Exits the process with an error code.
     * Extracted to a method to make the flow clearer and more maintainable.
     * @private
     */
    private _exitWithError(): void {
        process.exitCode = 1;
    }

    /**
     * Formats and logs the outcome of a single test with appropriate coloring.
     * Handles different test states (passed, failed, skipped) and retry attempts.
     * Now includes handling for interrupted tests and other unexpected statuses.
     *
     * @param title - The title of the test
     * @param result - The result of the test execution
     * @param timeTakenSec - The time taken by the test in seconds
     * @private
     */
    private _logTestOutcome(title: string, result: TestResult, timeTakenSec: number): void {
        const timeTakenFormatted = timeTakenSec.toFixed(2);
        let passMessage: string;

        switch (result.status) {
            case 'passed':
                passMessage = result.retry > 0 ? `✅ ${title} passed after retry` : `✅ ${title}`;
                console.log(`${colors.fgGreen}${passMessage} in ${timeTakenFormatted}s${colors.reset}`);
                break;

            case 'failed':
            case 'timedOut':
                if (result.retry > 0) {
                    console.log(
                        `${colors.fgYellow}🔄 Retry attempt #${result.retry + 1} for "${title}"${colors.reset}`,
                    );
                } else {
                    console.log(`${colors.fgRed}❌ ${title} failed in ${timeTakenFormatted}s${colors.reset}`);
                }
                break;

            case 'skipped':
                console.log(`${colors.fgGray}⚠️ ${title} was skipped${colors.reset}`);
                break;

            case 'interrupted':
                console.log(`${colors.fgRed}🛑 ${title} was interrupted${colors.reset}`);
                break;

            default:
                console.log(
                    `${colors.fgRed}⚠️ ${title} ended with unknown status: ${result.status} in ${timeTakenFormatted}s${colors.reset}`,
                );
                break;
        }
    }

    /**
     * Records the status of the last test run in a JSON file
     * @param hasFailed - Whether any tests failed
     */
    private saveLastRunStatus(hasFailed: boolean): void {
        const failedTests = Array.from(this._testRecords.values())
            .filter((record) => record.test.status === 'failed')
            .map((record) => record.test.testId || '');

        const lastRunData = {
            status: hasFailed ? 'failed' : 'passed',
            failedTests,
        };

        try {
            const filePath = path.join(this.outputDir, '.last-run.json');
            fs.writeFileSync(filePath, JSON.stringify(lastRunData, null, 2));
        } catch (error) {
            console.error('Failed to write last run status:', error);
        }
    }

    /**
     * Generates AI-powered fix suggestions for test failures
     * 
     * @param failures - Array of test failures
     * @private
     */
    private async _generateFixSuggestions(failures: TestFailure[]): Promise<void> {
        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}🤖 Generating AI-powered fix suggestions...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        const sourceCodeCache = new Map<string, string>();
        
        for (const failure of failures) {
            if (!failure.testFile) continue;

            try {
                console.log(`${colors.fgYellow}Generating fix suggestion for: ${failure.testTitle}${colors.reset}`);
                
                // Read the source file
                if (!sourceCodeCache.has(failure.testFile)) {
                    const source = fs.readFileSync(failure.testFile, 'utf8');
                    sourceCodeCache.set(failure.testFile, source);
                }
                
                const result = await GenAIUtils.generateFixSuggestion(failure, sourceCodeCache);
                
                if (result) {
                    console.log(`${colors.fgGreen}✅ Fix suggestion generated:${colors.reset}`);
                    console.log(`${colors.fgGreen}  - Prompt: ${result.promptPath}${colors.reset}`);
                    console.log(`${colors.fgGreen}  - Fix: ${result.fixPath}${colors.reset}`);
                } else {
                    console.warn(`${colors.fgYellow}⚠️ Could not generate fix suggestion.${colors.reset}`);
                    console.warn(`${colors.fgYellow}   Check if you have a .env file with MISTRAL_API_KEY in the project root.${colors.reset}`);
                }
            } catch (error) {
                console.error(`${colors.fgRed}❌ Error generating fix suggestion for ${failure.testTitle}: ${error}${colors.reset}`);
            }
        }
        
        console.log(`${colors.fgCyan}AI fix suggestion generation complete${colors.reset}`);
        
        console.log(`${colors.fgCyan}Thank you for using the AI fix suggestion tool!${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
    }
}
