import {defineConfig} from '@playwright/test';
import PlaywrightTestReporter from './src/reporter';

export default defineConfig({
    name: 'Playwright Test Configuration',
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
        // Use our custom reporter
        [
            './src/reporter.ts',
            {
                slowTestThreshold: 3,
                maxSlowTestsToShow: 5,
                timeoutWarningThreshold: 20,
                showStackTrace: true,
                outputDir: './test-results',
                generateFix: true,
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
