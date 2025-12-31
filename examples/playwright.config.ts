import {defineConfig} from '@playwright/test';
import {resolve} from 'path';

export default defineConfig({
    name: 'Playwright Smart Reporter Examples',
    testDir: './tests',
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['list'],
        // Use the built-in HTML reporter
        ['html', {outputFolder: 'test-results/html-report', open: 'never'}],
        // Use our custom AI-powered reporter with all available configuration options
        [
            'playwright-ai-reporter',
            {
                // Performance thresholds
                slowTestThreshold: 3, // Tests slower than 3 seconds are flagged as slow
                maxSlowTestsToShow: 5, // Show top 5 slowest tests in the report
                timeoutWarningThreshold: 20, // Warn if tests approach timeout (20 seconds)

                // Output configuration
                showStackTrace: true, // Include full stack traces in error reports
                outputDir: './test-results', // Directory for JSON output files

                // AI & Automation features
                generateFix: true, // Enable AI-powered fix suggestions for failures (creates fix files)
                createBug: false, // Auto-create bugs for failures (requires bug tracker provider)
                generatePR: false, // Auto-generate PRs with fixes (requires generateFix=true and PR provider)
                publishToDB: false, // Publish test results to database (requires database provider)
                sendEmail: false, // Enable email notifications (requires EMAIL_* env vars)

                // Note: Provider configuration is handled via environment variables
                // See env-configs/ folder for sample configurations
            },
        ],
    ],
    use: {
        actionTimeout: 0,
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
            },
        },
    ],
});
