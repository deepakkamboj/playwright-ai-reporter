import {test, expect} from '@playwright/test';

// Annotate the test suite with the QA team ownership
test.describe('Google search tests', () => {
    test.beforeEach(async ({page}) => {
        // Navigate to Google
        await page.goto('https://www.google.com');

        // Accept cookies if the dialog appears (handle this conditionally)
        const acceptButton = page.getByRole('button', {name: /Accept|I agree|Accept all/i});
        if (await acceptButton.isVisible().catch(() => false)) {
            await acceptButton.click();
        }
    });

    // Add team ownership in the title for this specific test
    test(
        'Search for Playwright',
        {
            annotation: {
                type: 'team',
                description: 'Frontend',
            },
        },
        async ({page}) => {
            // Type "Playwright automation" into the search box
            await page.getByRole('combobox', {name: 'Search'}).fill('Playwright automation');

            // Press Enter to search
            await page.keyboard.press('Enter');

            // Wait for the search results
            await page.waitForLoadState('networkidle');

            // Verify search results contain Playwright
            const results = page.locator('#search');
            await expect(results).toContainText(/Playwright/i);
        },
    );

    test(
        'Check Google Images link',
        {
            annotation: {
                type: 'team',
                description: 'Frontend',
            },
        },
        async ({page}) => {
            // Click on the "Images" link
            await page.getByRole('link', {name: 'Images'}).click();

            // Verify we're on the Google Images page
            await expect(page).toHaveURL(/.*\/imghp/);

            // Verify the search box is visible on the Images page
            await expect(page.getByRole('combobox', {name: 'Search'})).toBeVisible();
        },
    );
});
