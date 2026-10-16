import {Reporter, TestCase, TestResult, FullConfig, Suite, TestStep, FullResult} from '@playwright/test/reporter';
import {colors} from './colors';
import {TestRecord, ReporterConfig, TestSummary, TestCaseDetails, TestFailure, BuildInfo} from './types';
import {TestUtils, Logger} from './utils/utils';
import {FileHandler} from './utils/fileHandlerUtils';
import {BuildInfoUtils} from './utils/buildInfoUtils';
import {GenAIUtils, FixSuggestion} from './utils/genaiUtils';
import {ReportGenerator} from './utils/reportGenerator';
import {ProviderRegistry} from './providers/ProviderRegistry';
import {BugPriority} from './providers/interfaces/IBugTrackerProvider';
import {NotificationSeverity} from './providers/interfaces/INotificationProvider';
import {bugTitle, buildBugDescription} from './utils/bugReport';
import {closeFixedBugs, TEST_FAILURE_LABEL} from './utils/bugLifecycle';
import {stripAnsi} from './utils/ansi';
import {HistoryRun, historyFor, loadHistory, recordRun, saveHistory, testKey, trendOf} from './utils/historyStore';
import {describeTest, isRecordedAttachment, statusOf} from './utils/testReportData';
import {buildSummaryMarkdown} from './utils/summaryMarkdown';
import {redactJson, redactText} from './utils/redaction';
import * as path from 'path';
import * as fs from 'fs';

/** Key that links a failure to its AI analysis. Test ids are unique; titles are the fallback. */
function failureKey(failure: TestFailure): string {
    return failure.testId ?? failure.testTitle;
}

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
            // Empty means "history.json inside the output directory", resolved when it is used.
            historyFile: config.historyFile ?? '',
            generateFix: config.generateFix ?? false,
            createBug: config.createBug ?? false,
            closeFixedBugs: config.closeFixedBugs ?? false,
            generatePR: config.generatePR ?? false,
            publishToDB: config.publishToDB ?? false,
            sendEmail: config.sendEmail ?? false,
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
            `${colors.fgCyan}🚀 Starting test run: ${totalTestCount} tests using ${config.workers} workers${colors.reset}`,
        );
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}Test run started at: ${new Date().toLocaleString()}${colors.reset}`);

        // Get project name(s) from configuration
        const projectNames =
            config.projects
                ?.map((project) => project.name)
                .filter(Boolean)
                .join(', ') || 'Default Project';

        console.log(`
            Playwright Test Configuration:
            Project Names: ${projectNames}
            Generate Fix: ${this._config.generateFix}
            Create Bug: ${this._config.createBug}
            Close Fixed Bugs: ${this._config.closeFixedBugs}
            Generate PR: ${this._config.generatePR}
            Publish to DB: ${this._config.publishToDB}
            Send Email: ${this._config.sendEmail}
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
                    this._fileHandler.dispose();
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
        console.error(`${colors.fgRed}❌ Setup or runtime error: ${redactText(error.message)}${colors.reset}`);
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

        console.log(
            `${colors.fgCyan}Finished test: ${colors.fgYellow}${test.title}${colors.fgCyan}: ${result.status.toUpperCase()}${colors.reset}`,
        );

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

            const project = test.parent?.project?.()?.name;
            if (project) testCaseDetails.project = project;

            this._testRecords.set(title, {
                test: testCaseDetails,
                attempts: [],
            });
        }

        // Update test record with new attempt
        const testRecord = this._testRecords.get(title);
        if (testRecord) {
            // The outcome depends on every attempt (a retry can turn a failure into a flaky pass),
            // so refresh it instead of keeping the value from the first attempt.
            testRecord.test.outcome = test.outcome();
            testRecord.test.status = TestUtils.outcomeToStatus(test.outcome());

            // Fix: Added null check instead of non-null assertion
            testRecord.attempts.push({
                status: result.status,
                duration: timeTakenSec,
                retry: result.retry,
                ...(result.startTime ? {startTime: result.startTime.toISOString()} : {}),
                workerIndex: result.workerIndex,
                errors: result.errors.map((e) => ({
                    message: stripAnsi(e.message || 'No error message'),
                    stack: e.stack ? stripAnsi(e.stack) : e.stack,
                })),
                attachments: (result.attachments ?? []).map((attachment) => ({
                    name: attachment.name,
                    contentType: attachment.contentType,
                    ...(attachment.path ? {path: attachment.path} : {}),
                    ...(attachment.body && isRecordedAttachment(attachment)
                        ? {body: attachment.body.toString('utf8')}
                        : {}),
                })),
            });
        }

        // Add failures to the FileHandler
        if (result.status === 'failed' || result.status === 'timedOut') {
            const errorMessage = stripAnsi(result.errors[0]?.message || 'Unknown error');
            const errorCategory = TestUtils.categorizeError(errorMessage);

            this._fileHandler.addFailure({
                testId: test.id,
                testTitle: test.title,
                suiteTitle: test.parent?.title || 'Unknown Suite',
                errorMessage: errorMessage,
                errorStack: stripAnsi(result.errors[0]?.stack || ''),
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
     * Called when a test begins.
     *
     * @param test - The test case that is starting
     */
    public async onTestBegin(test: TestCase, result: TestResult): Promise<void> {
        if (result.retry > 0) {
            console.log(
                `${colors.fgYellow}🔄 Retrying test (attempt #${result.retry + 1}): ${colors.fgYellow}${test.title}${colors.reset}`,
            );
        } else {
            console.log(`${colors.fgCyan}Starting test: ${colors.fgYellow}${test.title}${colors.reset}`);
        }
    }

    /**
     * Called when a test step begins.
     *
     * @param test - The test case
     * @param result - The current test result
     * @param step - The test step that is starting
     */
    public async onStepBegin(test: TestCase, result: TestResult, step: TestStep): Promise<void> {
        if (step.category !== 'test.step') return;

        this._log('debug', `Test step BEGIN: ${step.title}`);
    }

    /**
     * Called when a test step ends.
     *
     * @param test - The test case
     * @param result - The current test result
     * @param step - The test step that ended
     */
    public async onStepEnd(test: TestCase, result: TestResult, step: TestStep): Promise<void> {
        if (step.category !== 'test.step') return;

        if (step.error) {
            this._log('error', `Test step FAILED: ${step.title}`);
        } else {
            this._log('debug', `Test step END: ${step.title}`);
        }
    }

    /**
     * Called when all tests have completed.
     * Processes results, displays summary statistics, and sets appropriate exit code.
     * Now properly handles all error conditions including non-test errors.
     */
    public async onEnd(result: FullResult): Promise<void> {
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}Finished the test run: ${result.status.toUpperCase()}${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

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

        // Attach attempts, artifacts and the flakiness verdict before anything uses the failures
        const history = this._enrichResults(failures);

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

        // Analyse failures with AI if enabled; the analysis is reused in the bug report
        const suggestions =
            this._config.generateFix && failures.length > 0
                ? await this._generateFixSuggestions(failures)
                : new Map<string, FixSuggestion>();

        // Create bugs if enabled
        if (this._config.createBug && failures.length > 0) {
            await this._createBugsForFailures(failures, suggestions, buildInfo);
        }

        // Close bugs whose test is now verified green
        if (this._config.closeFixedBugs) {
            await this._closeFixedBugs(failures, buildInfo);
        }

        // Log results
        Logger.logSummary(summary);

        // Report non-test errors
        if (this._nonTestErrors.length > 0) {
            console.log(`${colors.fgRed}\nSetup or Teardown Errors:${colors.reset}`);
            this._nonTestErrors.forEach((error, index) => {
                console.log(`${colors.fgRed}Error #${index + 1}: ${redactText(error.message)}${colors.reset}`);
                if (error.stack && this._config.showStackTrace) {
                    console.log(`${colors.fgRed}${redactText(error.stack)}${colors.reset}`);
                }
            });
        }

        // Report test failures
        if (failures.length > 0) {
            Logger.logFailures(failures);
        }

        // Extract all test case details for summary
        const allTestCases: TestCaseDetails[] = Array.from(this._testRecords.values()).map((record) => record.test);

        // Remember this run so the next one can tell flaky from broken
        summary.trend = trendOf(this._saveHistory(history, buildInfo));

        // Write summary and test details to JSON
        this._fileHandler.writeSummary(summary, allTestCases);

        // Generate HTML test health report
        const reportGenerator = new ReportGenerator(this.outputDir);
        try {
            const reportPath = reportGenerator.generateReport();
            ReportGenerator.printReportLink(reportPath);
        } catch (reportError) {
            console.warn(`${colors.fgYellow}⚠ Failed to generate HTML report: ${reportError}${colors.reset}`);
        }

        this._writeSummaryMarkdown(summary, allTestCases);

        // Publish to database if enabled
        if (this._config.publishToDB) {
            await this._publishToDatabase(summary, allTestCases, failures);
        }

        // Send email notification if enabled
        if (this._config.sendEmail) {
            await this._sendEmailNotification(summary, failures);
        }

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
     * Writes summary.md next to the report and hands it to the CI system: GitHub Actions shows it on the
     * job page, Azure Pipelines on the build page. A failure here never fails the run.
     */
    private _writeSummaryMarkdown(summary: TestSummary, tests: TestCaseDetails[]): void {
        try {
            const markdown = redactText(buildSummaryMarkdown(summary, tests, 'test-health-report.html'));
            const file = path.resolve(this.outputDir, 'summary.md');
            fs.writeFileSync(file, markdown);

            if (process.env.GITHUB_STEP_SUMMARY) {
                fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
            }
            if (process.env.TF_BUILD) {
                console.log(`##vso[task.uploadsummary]${file}`);
            }
        } catch (error) {
            console.warn(`${colors.fgYellow}⚠ Could not write the Markdown summary: ${error}${colors.reset}`);
        }
    }

    /** Where the run history is kept. */
    private get _historyPath(): string {
        return this._config.historyFile || path.join(this.outputDir, 'history.json');
    }

    /**
     * Adds attempts, artifact links and a flakiness verdict to every test and failure.
     * Returns the history that was used, so this run can be appended to it afterwards.
     */
    private _enrichResults(failures: TestFailure[]): HistoryRun[] {
        const history = loadHistory(this._historyPath);

        for (const record of this._testRecords.values()) {
            const key = testKey(record.test.testFile, record.test.testTitle);
            const data = describeTest(record, historyFor(history, key), this.outputDir);
            Object.assign(record.test, data);
            if (typeof data.meta?.owner === 'string' && data.meta.owner) {
                record.test.owningTeam = data.meta.owner;
            }
        }

        for (const failure of failures) {
            const record = this._testRecords.get(failure.testTitle);
            if (record) {
                const {retryCount, attempts, artifacts, flakiness, meta, apiCalls, owningTeam} = record.test;
                Object.assign(failure, {
                    retryCount,
                    attempts,
                    artifacts,
                    flakiness,
                    ...(meta ? {meta} : {}),
                    ...(apiCalls ? {apiCalls} : {}),
                });
                if (owningTeam) failure.owningTeam = owningTeam;
            }
        }

        return history;
    }

    /** Appends this run to the history file. History is an aid: a write failure must not fail the run. */
    private _saveHistory(history: HistoryRun[], buildInfo: BuildInfo): HistoryRun[] {
        try {
            const tests: HistoryRun['tests'] = {};
            for (const record of this._testRecords.values()) {
                const details = record.test;
                const failed = statusOf(details.outcome) === 'failed' || statusOf(details.outcome) === 'flaky';
                const lastAttempt = record.attempts[record.attempts.length - 1];
                tests[testKey(details.testFile, details.testTitle)] = {
                    status: statusOf(details.outcome),
                    durationMs: Math.round((lastAttempt?.duration ?? 0) * 1000),
                    ...(failed && details.flakiness?.primaryPattern ? {kind: details.flakiness.primaryPattern} : {}),
                };
            }

            const runs = recordRun(history, {
                time: new Date().toISOString(),
                ...(buildInfo.buildId ? {runId: buildInfo.buildId} : {}),
                tests,
            });
            saveHistory(this._historyPath, runs);
            return runs;
        } catch (error) {
            console.warn(`${colors.fgYellow}⚠ Could not update run history: ${error}${colors.reset}`);
            return history;
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
     * Helper method to log messages with appropriate coloring.
     *
     * @param level - The log level ('debug' or 'error')
     * @param message - The message to log
     * @private
     */
    private _log(level: 'debug' | 'error', message: string): void {
        if (level === 'error') {
            console.log(`${colors.fgRed}${message}${colors.reset}`);
        } else {
            console.log(`${colors.fgGray}${message}${colors.reset}`);
        }
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
            // Ensure output directory exists
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, {recursive: true});
                console.log(`Created output directory: ${path.resolve(this.outputDir)}`);
            }

            const filePath = path.join(this.outputDir, '.last-run.json');
            fs.writeFileSync(filePath, redactJson(lastRunData, 2));
            console.log(`Last run status written to: ${path.resolve(filePath)}`);
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
    private async _generateFixSuggestions(failures: TestFailure[]): Promise<Map<string, FixSuggestion>> {
        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}🤖 Analysing failures with AI...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        const sourceCodeCache = new Map<string, string>();
        const suggestions = new Map<string, FixSuggestion>();

        for (const failure of failures) {
            if (!failure.testFile) continue;

            try {
                console.log(`${colors.fgYellow}Analysing: ${redactText(failure.testTitle)}${colors.reset}`);

                // Read the source file
                if (!sourceCodeCache.has(failure.testFile)) {
                    const source = fs.readFileSync(failure.testFile, 'utf8');
                    sourceCodeCache.set(failure.testFile, source);
                }

                const result = await GenAIUtils.generateFixSuggestion(failure, sourceCodeCache);

                if (result) {
                    suggestions.set(failureKey(failure), result);
                    failure.analysis = result.analysis.slice(0, 20000);
                    failure.analysisFile = path.relative(this.outputDir, result.fixPath).replace(/\\/g, '/');
                    failure.fixAccepted = result.replacement?.ok === true;
                    console.log(`${colors.fgGreen}✅ Analysis generated:${colors.reset}`);
                    console.log(`${colors.fgGreen}  - Prompt: ${result.promptPath}${colors.reset}`);
                    console.log(`${colors.fgGreen}  - Response: ${result.fixPath}${colors.reset}`);

                    // Generate PR only if generatePR flag is enabled
                    if (this._config.generatePR) {
                        console.log(`${colors.fgCyan}🔄 Generating pull request with fix...${colors.reset}`);
                        await this._generatePullRequest(failure, result);
                    }
                } else {
                    console.warn(`${colors.fgYellow}⚠️ Could not generate an analysis.${colors.reset}`);
                    console.warn(
                        `${colors.fgYellow}   Check AI_PROVIDER and the provider's credentials (see README, "AI providers").${colors.reset}`,
                    );
                }
            } catch (error) {
                console.error(
                    `${colors.fgRed}❌ Error generating fix suggestion for ${redactText(failure.testTitle)}: ${redactText(String(error))}${colors.reset}`,
                );
            }
        }

        console.log(`${colors.fgCyan}AI analysis complete${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

        return suggestions;
    }

    /**
     * Generates a pull request with the AI-generated fix.
     *
     * Only a validated, complete corrected file is committed. If the model returned no corrected
     * file, or the file fails the safety checks, no branch or pull request is created.
     *
     * @param failure - The test failure information
     * @param suggestion - The analysis and validated replacement from GenAIUtils
     * @private
     */
    private async _generatePullRequest(failure: TestFailure, suggestion: FixSuggestion): Promise<void> {
        if (suggestion.patchedSource === undefined) {
            console.log(
                `${colors.fgYellow}   No corrected file returned; skipping the pull request (see ${suggestion.fixPath}).${colors.reset}`,
            );
            return;
        }

        if (!suggestion.replacement?.ok) {
            console.warn(
                `${colors.fgYellow}⚠️ Skipping the pull request. The corrected file was rejected:${colors.reset}`,
            );
            for (const reason of suggestion.replacement?.reasons ?? []) {
                console.warn(`${colors.fgYellow}   - ${reason}${colors.reset}`);
            }
            return;
        }

        try {
            // Get the PR provider from registry
            const prProvider = await ProviderRegistry.getPRProvider();

            const fixContent = suggestion.patchedSource;

            if (!failure.testFile) {
                console.warn(`${colors.fgYellow}⚠️ Cannot create PR: test file path not available${colors.reset}`);
                return;
            }

            // Generate branch name from test info
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const sanitizedTestTitle = failure.testTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const branchName = `autofix/${sanitizedTestTitle}-${timestamp}`;

            // Get base branch from environment or default to main
            const baseBranch = process.env.BASE_BRANCH || process.env.GITHUB_BASE_REF || 'main';

            console.log(`${colors.fgCyan}   Creating topic branch: ${branchName}${colors.reset}`);

            // Step 1: Create the topic branch
            const branchCreated = await prProvider.createBranch(branchName, baseBranch);
            if (!branchCreated) {
                console.error(`${colors.fgRed}❌ Failed to create branch: ${branchName}${colors.reset}`);
                return;
            }
            console.log(`${colors.fgGreen}   ✅ Branch created successfully${colors.reset}`);

            // Step 2: Prepare file changes for commit
            const fileChanges: Array<{path: string; content: string; action: 'add' | 'modify' | 'delete'}> = [
                {
                    path: failure.testFile,
                    content: fixContent,
                    action: 'modify',
                },
            ];

            // Step 3: Commit changes to the topic branch
            console.log(`${colors.fgCyan}   Committing changes to ${branchName}${colors.reset}`);
            const commitMessage = `fix: Auto-fix for failing test "${failure.testTitle}"

            Test: ${failure.testTitle}
            Suite: ${failure.suiteTitle}
            File: ${failure.testFile}
            Error: ${failure.errorMessage.substring(0, 100)}${failure.errorMessage.length > 100 ? '...' : ''}

            This is an AI-generated fix suggestion.`;

            const commitHash = await prProvider.commitChanges(branchName, fileChanges, commitMessage);
            if (!commitHash) {
                console.error(`${colors.fgRed}❌ Failed to commit changes${colors.reset}`);
                return;
            }
            console.log(`${colors.fgGreen}   ✅ Changes committed: ${commitHash.substring(0, 7)}${colors.reset}`);

            // Step 4: Create pull request from topic branch to base branch
            console.log(`${colors.fgCyan}   Creating pull request: ${branchName} → ${baseBranch}${colors.reset}`);
            const prInfo = await prProvider.createPullRequest({
                sourceBranch: branchName,
                targetBranch: baseBranch,
                title: `🤖 Auto-fix: ${failure.testTitle}`,
                description: [
                    '## AI-Generated Fix Suggestion',
                    '',
                    `**Test**: ${failure.testTitle}`,
                    `**Suite**: ${failure.suiteTitle}`,
                    `**File**: \`${failure.testFile}\``,
                    '',
                    '### Error',
                    '```',
                    failure.errorMessage,
                    '```',
                    '',
                    '### Error Category',
                    failure.errorCategory,
                    '',
                    '### Root cause analysis (AI)',
                    suggestion.analysis || '_No analysis returned._',
                    '',
                    '### Review',
                    'The corrected file passed the reporter safety checks (no fewer assertions, no new skips,',
                    'no new fixed waits, bounded size). It is still AI-generated: review carefully before merging.',
                    '',
                    `**Fix Details**: See commit ${commitHash?.substring(0, 7) || 'unknown'}`,
                    '',
                    '---',
                    '_This PR was automatically generated by playwright-ai-reporter_',
                ].join('\n'),
                labels: ['auto-fix', 'test-failure', 'ai-generated'],
                draft: true, // Create as draft for review
            });

            if (prInfo) {
                console.log(`${colors.fgGreen}✅ Pull request created successfully:${colors.reset}`);
                failure.pullRequestUrl = prInfo.url;
                console.log(`${colors.fgGreen}   PR #${prInfo.number}: ${prInfo.url}${colors.reset}`);
                console.log(
                    `${colors.fgGreen}   Branch: ${prInfo.sourceBranch} → ${prInfo.targetBranch}${colors.reset}`,
                );
                console.log(`${colors.fgGreen}   Status: ${prInfo.status} (draft)${colors.reset}`);
            } else {
                console.warn(`${colors.fgYellow}⚠️ Failed to create pull request${colors.reset}`);
            }
        } catch (error) {
            console.error(`${colors.fgRed}❌ Error creating pull request: ${error}${colors.reset}`);
            if (error instanceof Error) {
                console.error(`${colors.fgRed}   ${error.message}${colors.reset}`);
                if (error.message.includes('PR provider configuration not found')) {
                    console.error(`${colors.fgRed}   Please configure PR provider in your .env file${colors.reset}`);
                    console.error(`${colors.fgRed}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                }
            }
        }
    }

    /**
     * Creates bugs in the configured bug tracker for test failures
     *
     * @param failures - Array of test failures
     * @param suggestions - AI analyses by failure, included in the bug when available
     * @param buildInfo - Run details (run URL, branch, commit, artifacts) included in the bug
     * @private
     */
    private async _createBugsForFailures(
        failures: TestFailure[],
        suggestions: Map<string, FixSuggestion>,
        buildInfo: BuildInfo,
    ): Promise<void> {
        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}🐛 Creating bugs for test failures...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

        try {
            // Get the bug tracker provider from registry
            const bugTracker = await ProviderRegistry.getBugTrackerProvider();

            for (const failure of failures) {
                try {
                    console.log(`${colors.fgYellow}Creating bug for: ${redactText(failure.testTitle)}${colors.reset}`);

                    // Create the bug
                    const analysis = suggestions.get(failureKey(failure))?.analysis;
                    const bugInfo = await bugTracker.createBug({
                        title: bugTitle(failure.testTitle),
                        description: buildBugDescription(failure, {
                            ...(analysis ? {analysis} : {}),
                            buildInfo,
                        }),
                        priority: failure.isTimeout ? BugPriority.High : BugPriority.Medium,
                        labels: [TEST_FAILURE_LABEL, 'automated', failure.errorCategory.toLowerCase()],
                        // Team names are not GitHub or Jira logins; use an explicit assignee only.
                        assignee: process.env.BUG_ASSIGNEE || undefined,
                        testFailure: failure,
                    });

                    if (bugInfo) {
                        console.log(`${colors.fgGreen}   ✅ Bug created: ${bugInfo.url}${colors.reset}`);
                        console.log(
                            `${colors.fgGreen}      ID: ${bugInfo.id} | Status: ${bugInfo.status}${colors.reset}`,
                        );
                    } else {
                        console.warn(`${colors.fgYellow}   ⚠️ Failed to create bug${colors.reset}`);
                    }
                } catch (error) {
                    console.error(
                        `${colors.fgRed}   ❌ Error creating bug for ${failure.testTitle}: ${error}${colors.reset}`,
                    );
                }
            }

            console.log(`${colors.fgGreen}✅ Bug creation complete${colors.reset}`);
        } catch (error) {
            console.error(`${colors.fgRed}❌ Error accessing bug tracker: ${error}${colors.reset}`);
            if (error instanceof Error) {
                console.error(`${colors.fgRed}   ${error.message}${colors.reset}`);
                if (error.message.includes('Bug tracker provider configuration not found')) {
                    console.error(
                        `${colors.fgRed}   Please configure bug tracker provider in your .env file${colors.reset}`,
                    );
                    console.error(`${colors.fgRed}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                }
            }
        }

        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
    }

    /**
     * Closes open test-failure bugs for tests that passed in this run.
     *
     * A test counts as verified only when it passed without needing a retry (a flaky test is not
     * verified) and no test with the same title failed in this run.
     *
     * @param failures - Failures in this run
     * @param buildInfo - Run details included in the closing comment
     * @private
     */
    private async _closeFixedBugs(failures: TestFailure[], buildInfo: BuildInfo): Promise<void> {
        const failingTitles = new Set(failures.map((failure) => failure.testTitle));
        const verifiedTitles = Array.from(this._testRecords.values())
            .filter((record) => record.test.outcome === 'expected')
            .map((record) => record.test.testTitle)
            .filter((title) => !failingTitles.has(title));

        if (verifiedTitles.length === 0) {
            return;
        }

        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}🔒 Closing bugs for tests that now pass...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

        try {
            const bugTracker = await ProviderRegistry.getBugTrackerProvider();
            const closed = await closeFixedBugs(bugTracker, verifiedTitles, buildInfo);

            for (const {bug, testTitle} of closed) {
                console.log(`${colors.fgGreen}   ✅ Closed #${bug.id} for "${testTitle}": ${bug.url}${colors.reset}`);
            }
            if (closed.length === 0) {
                console.log(`${colors.fgGray}   No open bugs matched a passing test.${colors.reset}`);
            }
        } catch (error) {
            console.error(`${colors.fgRed}❌ Error closing fixed bugs: ${error}${colors.reset}`);
        }
    }

    /**
     * Publishes test results to database
     *
     * @param summary - Test run summary
     * @param allTestCases - All test cases details
     * @param failures - Test failures
     * @private
     */
    private async _publishToDatabase(
        summary: TestSummary,
        allTestCases: TestCaseDetails[],
        failures: TestFailure[],
    ): Promise<void> {
        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}📊 Publishing test results to database...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

        try {
            // Check if database provider is configured
            const dbConfig = process.env.DATABASE_PROVIDER;
            if (!dbConfig) {
                console.log(`${colors.fgYellow}⚠️ Database provider not configured${colors.reset}`);
                console.log(
                    `${colors.fgYellow}   Set DATABASE_PROVIDER in your .env file to enable database logging${colors.reset}`,
                );
                console.log(`${colors.fgYellow}   Example: DATABASE_PROVIDER=sqlite${colors.reset}`);
                console.log(`${colors.fgYellow}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                console.log(`${colors.fgCyan}===============================================${colors.reset}`);
                return;
            }

            // Get the database provider from registry
            const dbProvider = await ProviderRegistry.getDatabaseProvider();

            // Initialize database (creates DB and tables if they don't exist)
            console.log(`${colors.fgCyan}   Initializing database connection...${colors.reset}`);
            await dbProvider.initialize();
            console.log(`${colors.fgGreen}   ✅ Database initialized${colors.reset}`);

            // Save test run data
            console.log(`${colors.fgCyan}   Saving test run data...${colors.reset}`);
            const testRunId = await dbProvider.saveTestRun({
                name: `Test Run ${new Date().toISOString()}`,
                timestamp: new Date(),
                environment: process.env.NODE_ENV || 'test',
                branch: summary.buildInfo?.buildBranch,
                commitHash: summary.buildInfo?.commitId,
                totalTests: summary.testCount,
                passedTests: summary.passedCount,
                failedTests: summary.failedCount,
                skippedTests: summary.skippedCount,
                duration: parseFloat(summary.totalTimeDisplay),
                metadata: {
                    buildInfo: summary.buildInfo,
                },
            });
            console.log(`${colors.fgGreen}   ✅ Test run saved (ID: ${testRunId})${colors.reset}`);

            // Save individual test results
            console.log(`${colors.fgCyan}   Saving ${allTestCases.length} test results...${colors.reset}`);
            for (const testCase of allTestCases) {
                const failure = failures.find((f) => f.testTitle === testCase.testTitle);
                await dbProvider.saveTestResult({
                    testRunId,
                    testId: testCase.testId || `test-${Date.now()}`,
                    testTitle: testCase.testTitle,
                    suiteTitle: testCase.suiteTitle,
                    status: testCase.status || 'unknown',
                    duration: testCase.duration || 0,
                    errorMessage: failure?.errorMessage,
                    errorStack: failure?.errorStack,
                    timestamp: new Date(),
                });
            }
            console.log(`${colors.fgGreen}   ✅ All test results saved${colors.reset}`);

            console.log(`${colors.fgGreen}✅ Test results published to database${colors.reset}`);
            console.log(
                `${colors.fgGreen}   Summary: ${summary.testCount} tests, ${summary.passedCount} passed, ${summary.failedCount} failed${colors.reset}`,
            );
        } catch (error) {
            console.error(`${colors.fgRed}❌ Error publishing to database: ${error}${colors.reset}`);
            if (error instanceof Error) {
                console.error(`${colors.fgRed}   ${error.message}${colors.reset}`);
                if (
                    error.message.includes('Database provider configuration not found') ||
                    error.message.includes('Database configuration not found')
                ) {
                    console.error(
                        `${colors.fgRed}   Please configure database provider in your .env file${colors.reset}`,
                    );
                    console.error(`${colors.fgRed}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                }
            }
        }

        console.log(`${colors.fgCyan}Database publishing complete${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
    }

    /**
     * Sends email notification with test results
     *
     * @param summary - Test run summary
     * @param failures - Test failures
     * @private
     */
    private async _sendEmailNotification(summary: TestSummary, failures: TestFailure[]): Promise<void> {
        console.log('\n');
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
        console.log(`${colors.fgCyan}📧 Sending email notification...${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);

        try {
            // Check if notification provider is configured
            const emailConfig = process.env.NOTIFICATION_PROVIDER;
            if (!emailConfig) {
                console.log(`${colors.fgYellow}⚠️ Email notification provider not configured${colors.reset}`);
                console.log(
                    `${colors.fgYellow}   Set NOTIFICATION_PROVIDER in your .env file to enable email notifications${colors.reset}`,
                );
                console.log(`${colors.fgYellow}   Example: NOTIFICATION_PROVIDER=email${colors.reset}`);
                console.log(`${colors.fgYellow}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                console.log(`${colors.fgCyan}===============================================${colors.reset}`);
                return;
            }

            // Get the notification provider from registry
            const notificationProvider = await ProviderRegistry.getNotificationProvider();

            // Get email recipients from environment or use default
            const recipients = process.env.EMAIL_RECIPIENTS?.split(',').map((r) => r.trim()) || [];
            if (recipients.length === 0) {
                console.log(`${colors.fgYellow}⚠️ No email recipients configured${colors.reset}`);
                console.log(
                    `${colors.fgYellow}   Set EMAIL_RECIPIENTS in your .env file (comma-separated)${colors.reset}`,
                );
                console.log(
                    `${colors.fgYellow}   Example: EMAIL_RECIPIENTS=dev@example.com,qa@example.com${colors.reset}`,
                );
                console.log(`${colors.fgCyan}===============================================${colors.reset}`);
                return;
            }

            console.log(`${colors.fgCyan}   Sending to: ${recipients.join(', ')}${colors.reset}`);

            // Determine notification severity
            const severity =
                summary.failedCount > 0
                    ? NotificationSeverity.Error
                    : summary.skippedCount > summary.testCount * 0.2
                      ? NotificationSeverity.Warning
                      : NotificationSeverity.Info;

            // Send test summary email
            console.log(`${colors.fgCyan}   Sending test summary...${colors.reset}`);
            const summaryResult = await notificationProvider.sendTestSummary(summary, {
                recipients,
                severity,
                subject: `Test Run ${summary.failedCount > 0 ? 'Failed' : 'Completed'}: ${summary.passedCount}/${summary.testCount} passed`,
            });

            if (summaryResult.success) {
                console.log(
                    `${colors.fgGreen}   ✅ Summary email sent (ID: ${summaryResult.messageId})${colors.reset}`,
                );
            } else {
                console.warn(
                    `${colors.fgYellow}   ⚠️ Failed to send summary email: ${summaryResult.error}${colors.reset}`,
                );
            }

            // Send failures email if there are failures
            if (failures.length > 0) {
                console.log(`${colors.fgCyan}   Sending failure details...${colors.reset}`);
                const failuresResult = await notificationProvider.sendTestFailures(failures, {
                    recipients,
                    severity: NotificationSeverity.Error,
                    subject: `Test Failures: ${failures.length} test(s) failed`,
                });

                if (failuresResult.success) {
                    console.log(
                        `${colors.fgGreen}   ✅ Failures email sent (ID: ${failuresResult.messageId})${colors.reset}`,
                    );
                } else {
                    console.warn(
                        `${colors.fgYellow}   ⚠️ Failed to send failures email: ${failuresResult.error}${colors.reset}`,
                    );
                }
            }

            console.log(`${colors.fgGreen}✅ Email notification complete${colors.reset}`);
        } catch (error) {
            console.error(`${colors.fgRed}❌ Error sending email notification: ${error}${colors.reset}`);
            if (error instanceof Error) {
                console.error(`${colors.fgRed}   ${error.message}${colors.reset}`);
                if (error.message.includes('Notification provider configuration not found')) {
                    console.error(
                        `${colors.fgRed}   Please configure notification provider in your .env file${colors.reset}`,
                    );
                    console.error(`${colors.fgRed}   See docs/ENV_CONFIG_GUIDE.md for details${colors.reset}`);
                }
            }
        }

        console.log(`${colors.fgCyan}Email notification complete${colors.reset}`);
        console.log(`${colors.fgCyan}===============================================${colors.reset}`);
    }
}
