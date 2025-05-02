import {test, expect} from '@playwright/test';

test.describe('Playwright official website tests', () => {
    test(
        'Verify Playwright homepage title and URL',
        {
            annotation: {
                type: 'team',
                description: 'Performance',
            },
        },
        async ({page}) => {
            // Navigate to the Playwright website
            await page.goto('https://playwright.dev');

            // Verify the title contains "Playwright"
            await expect(page).toHaveTitle(/Playwright/);

            // Verify the URL is correct
            await expect(page).toHaveURL('https://playwright.dev/');

            // Verify the main navigation is visible
            await expect(page.locator('nav')).toBeVisible();
        },
    );

    test(
        'Check Playwright docs navigation',
        {
            annotation: {
                type: 'team',
                description: 'Performance',
            },
        },
        async ({page}) => {
            // Navigate to the Playwright website
            await page.goto('https://playwright.dev');

            // Click on the Docs link
            await page.getByRole('link', {name: 'Docs', exact: true}).click();

            // Verify we're on the docs page
            await expect(page).toHaveURL(/.*docs/);

            // Verify the documentation sidebar is visible
            await expect(page.locator('.theme-doc-sidebar-container')).toBeVisible();
        },
    );
});
