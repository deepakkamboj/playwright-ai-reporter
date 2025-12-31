/**
 * Example: Using the Provider Framework in Reporter
 *
 * This file demonstrates how to integrate the provider framework
 * into the Playwright test reporter.
 */

import {ProviderRegistry} from '../providers/ProviderRegistry';
import {BugPriority, BugDetails} from '../providers/interfaces/IBugTrackerProvider';
import {TestRun, TestResult} from '../providers/interfaces/IDatabaseProvider';
import {NotificationDetails} from '../providers/interfaces/INotificationProvider';
import {TestFailure} from '../types';

/**
 * Example workflow for handling test failures
 */
export class ReporterWorkflow {
    /**
     * Initialize all providers at the start of the test run
     */
    static async initialize(): Promise<void> {
        // Initialize provider registry
        // This will load configuration from environment variables
        await ProviderRegistry.initialize();

        console.log('[Reporter] Provider framework initialized');
    }

    /**
     * Process a test failure through the complete workflow
     */
    static async processTestFailure(failure: TestFailure, sourceCode: Map<string, string>): Promise<void> {
        console.log(`[Reporter] Processing failure: ${failure.testTitle}`);

        try {
            // Step 1: Generate AI fix suggestion
            const aiSuggestion = await this.generateAISuggestion(failure, sourceCode);

            // Step 2: Create bug/issue (if enabled)
            if (process.env.ENABLE_BUG_CREATION === 'true') {
                const bugInfo = await this.createBug(failure, aiSuggestion);
                if (bugInfo) {
                    console.log(`[Reporter] Bug created: ${bugInfo.url}`);
                }
            }

            // Step 3: Auto-generate PR with fix (if enabled)
            if (process.env.ENABLE_PR_CREATION === 'true' && aiSuggestion) {
                const prInfo = await this.createFixPR(failure, aiSuggestion);
                if (prInfo) {
                    console.log(`[Reporter] PR created: ${prInfo.url}`);
                }
            }
        } catch (error) {
            console.error('[Reporter] Error processing test failure:', error);
        }
    }

    /**
     * Generate AI-powered fix suggestion
     */
    private static async generateAISuggestion(
        failure: TestFailure,
        sourceCode: Map<string, string>,
    ): Promise<string | null> {
        try {
            const aiProvider = await ProviderRegistry.getAIProvider();

            // Build the prompt
            const prompt = this.buildFixPrompt(failure, sourceCode);

            // Generate suggestion
            const response = await aiProvider.generateCompletion(
                [
                    {
                        role: 'system',
                        content: 'You are a test engineer helping debug flaky Playwright tests.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                {
                    maxTokens: 1000,
                    temperature: 0.7,
                },
            );

            return response.content;
        } catch (error) {
            console.error('[Reporter] Error generating AI suggestion:', error);
            return null;
        }
    }

    /**
     * Create a bug/issue for the test failure
     */
    private static async createBug(failure: TestFailure, aiSuggestion: string | null): Promise<any> {
        try {
            const bugTracker = await ProviderRegistry.getBugTrackerProvider();

            const bugDetails: BugDetails = {
                title: `Test Failure: ${failure.testTitle}`,
                description: this.buildBugDescription(failure, aiSuggestion),
                priority: this.determineBugPriority(failure),
                labels: ['test-failure', 'automated'],
                testFailure: failure,
                additionalFields: {
                    testFile: failure.testFile,
                    environment: process.env.TEST_ENVIRONMENT,
                    branch: process.env.BRANCH_NAME,
                },
            };

            return await bugTracker.createBug(bugDetails);
        } catch (error) {
            console.error('[Reporter] Error creating bug:', error);
            return null;
        }
    }

    /**
     * Create a PR with the suggested fix
     */
    private static async createFixPR(failure: TestFailure, aiSuggestion: string): Promise<any> {
        try {
            const prProvider = await ProviderRegistry.getPRProvider();

            // Extract code from AI suggestion (would need more sophisticated parsing)
            const fixedCode = this.extractCodeFromSuggestion(aiSuggestion);

            if (!fixedCode || !failure.testFile) {
                console.warn('[Reporter] Cannot create PR: missing code or file path');
                return null;
            }

            const prDetails = {
                title: `Fix: ${failure.testTitle}`,
                description: this.buildPRDescription(failure, aiSuggestion),
                sourceBranch: `fix/test-${failure.testId || Date.now()}`,
                targetBranch: process.env.BRANCH_NAME || 'main',
                labels: ['automated-fix', 'test-failure'],
                autoMerge: false,
            };

            // Note: Using createAutoFixPR for auto-generated fixes
            return await prProvider.createAutoFixPR(
                [{failure, fixContent: fixedCode, filePath: failure.testFile || ''}],
                process.env.BRANCH_NAME || 'main',
            );
        } catch (error) {
            console.error('[Reporter] Error creating PR:', error);
            return null;
        }
    }

    /**
     * Save test run to database
     */
    static async saveTestRun(summary: any): Promise<string | undefined> {
        if (process.env.ENABLE_DATABASE_LOGGING !== 'true') {
            return;
        }

        try {
            const database = await ProviderRegistry.getDatabaseProvider();

            const testRun: TestRun = {
                name: `Test Run ${new Date().toISOString()}`,
                timestamp: new Date(),
                environment: process.env.TEST_ENVIRONMENT,
                branch: process.env.BRANCH_NAME,
                commitHash: process.env.COMMIT_HASH,
                totalTests: summary.totalTests,
                passedTests: summary.passedTests,
                failedTests: summary.failedTests,
                skippedTests: summary.skippedTests,
                duration: summary.duration,
            };

            const runId = await database.saveTestRun(testRun);
            console.log(`[Reporter] Test run saved with ID: ${runId}`);

            return runId;
        } catch (error) {
            console.error('[Reporter] Error saving test run:', error);
        }
    }

    /**
     * Save individual test result to database
     */
    static async saveTestResult(testRunId: string, testCase: any): Promise<void> {
        if (process.env.ENABLE_DATABASE_LOGGING !== 'true') {
            return;
        }

        try {
            const database = await ProviderRegistry.getDatabaseProvider();

            const testResult: TestResult = {
                testRunId,
                testId: testCase.testId,
                testTitle: testCase.testTitle,
                suiteTitle: testCase.suiteTitle,
                status: testCase.status,
                duration: testCase.duration,
                errorMessage: testCase.errorMessage,
                errorStack: testCase.errorStack,
                retries: testCase.retries,
                timestamp: new Date(),
            };

            await database.saveTestResult(testResult);
        } catch (error) {
            console.error('[Reporter] Error saving test result:', error);
        }
    }

    /**
     * Send notification about test results
     */
    static async sendNotification(summary: any, failures: TestFailure[]): Promise<void> {
        if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
            return;
        }

        try {
            const notificationProvider = await ProviderRegistry.getNotificationProvider();

            const notification: NotificationDetails = {
                subject: `Test Run ${summary.failedTests > 0 ? 'Failed' : 'Passed'}: ${summary.totalTests} tests`,
                body: this.buildNotificationBody(summary, failures),
                priority: summary.failedTests > 0 ? 'high' : 'normal',
                recipients: process.env.EMAIL_TO?.split(',') || [],
                metadata: {
                    environment: process.env.TEST_ENVIRONMENT,
                    branch: process.env.BRANCH_NAME,
                    failedCount: summary.failedTests,
                },
            };

            await notificationProvider.sendNotification(notification);
            console.log('[Reporter] Notification sent');
        } catch (error) {
            console.error('[Reporter] Error sending notification:', error);
        }
    }

    /**
     * Cleanup all provider connections
     */
    static async cleanup(): Promise<void> {
        await ProviderRegistry.closeAll();
        console.log('[Reporter] Provider cleanup complete');
    }

    // Helper methods
    private static buildFixPrompt(failure: TestFailure, sourceCode: Map<string, string>): string {
        const source = failure.testFile ? sourceCode.get(failure.testFile) || '' : '';

        return [
            `# Instructions`,
            `- The following Playwright test failed.`,
            `- Explain why it failed and suggest a fix, respecting Playwright best practices.`,
            `- Provide a complete code snippet with the fix.`,
            ``,
            `# Test info`,
            `- Name: ${failure.testTitle}`,
            `- File: ${failure.testFile}`,
            ``,
            `# Error`,
            `\`\`\``,
            failure.errorMessage,
            `\`\`\``,
            ``,
            `# Test source`,
            `\`\`\`typescript`,
            source,
            `\`\`\``,
        ].join('\n');
    }

    private static buildBugDescription(failure: TestFailure, aiSuggestion: string | null): string {
        let description = `## Test Failure\n\n`;
        description += `**Test:** ${failure.testTitle}\n`;
        description += `**File:** ${failure.testFile}\n`;
        description += `**Status:** ${failure.status}\n\n`;
        description += `### Error\n\`\`\`\n${failure.errorMessage}\n\`\`\`\n\n`;

        if (aiSuggestion) {
            description += `### AI Suggested Fix\n${aiSuggestion}\n`;
        }

        return description;
    }

    private static buildPRDescription(failure: TestFailure, aiSuggestion: string): string {
        return [
            `## Automated Fix for Test Failure`,
            ``,
            `**Test:** ${failure.testTitle}`,
            `**File:** ${failure.testFile}`,
            ``,
            `### Original Error`,
            `\`\`\``,
            failure.errorMessage,
            `\`\`\``,
            ``,
            `### AI Analysis and Fix`,
            aiSuggestion,
            ``,
            `---`,
            `*This PR was automatically generated by the Playwright AI Test Reporter*`,
        ].join('\n');
    }

    private static buildNotificationBody(summary: any, failures: TestFailure[]): string {
        let body = `Test Run Summary:\n\n`;
        body += `Total Tests: ${summary.totalTests}\n`;
        body += `Passed: ${summary.passedTests}\n`;
        body += `Failed: ${summary.failedTests}\n`;
        body += `Skipped: ${summary.skippedTests}\n`;
        body += `Duration: ${summary.duration}ms\n\n`;

        if (failures.length > 0) {
            body += `Failed Tests:\n`;
            failures.forEach((f, i) => {
                body += `${i + 1}. ${f.testTitle}\n`;
                body += `   Error: ${f.errorMessage?.substring(0, 100)}...\n\n`;
            });
        }

        return body;
    }

    private static determineBugPriority(failure: TestFailure): BugPriority {
        // Logic to determine priority based on test characteristics
        if (failure.errorMessage?.includes('timeout')) {
            return BugPriority.High;
        }
        return BugPriority.Medium;
    }

    private static extractCodeFromSuggestion(suggestion: string): string | null {
        // Extract code blocks from markdown
        const codeBlockMatch = suggestion.match(/```(?:typescript|ts)?\n([\s\S]+?)\n```/);
        return codeBlockMatch ? codeBlockMatch[1] : null;
    }
}
