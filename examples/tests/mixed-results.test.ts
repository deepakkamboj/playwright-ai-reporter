import {test, expect} from '@playwright/test';

test.describe('Mixed test results to demonstrate reporter', () => {
    test(
        'Passing test - Visit MDN web docs',
        {
            annotation: {
                type: 'team',
                description: 'Performance',
            },
        },
        async ({page}) => {
            // Visit MDN Web Docs
            await page.goto('https://developer.mozilla.org');

            // Verify the title contains "MDN"
            await expect(page).toHaveTitle(/MDN/);

            // Take a bit of time to show as a "slower" test
            await page.waitForTimeout(2000);
        },
    );

    test(
        'Verify non-existent element',
        {
            annotation: [
                {type: 'team', description: 'Performance'},
                {type: 'performance', description: 'very slow test!'},
            ],
        },
        async ({page}) => {
            // Visit Google
            await page.goto('https://www.google.com');

            // This will fail because the element doesn't exist
            await expect(page.locator('#non-existent-element')).toBeVisible({timeout: 5000});
        },
    );

    test.skip('Skipped test - This test is intentionally skipped', async ({page}) => {
        // This test will be skipped
        await page.goto('https://github.com');
        await expect(page).toHaveTitle(/GitHub/);
    });

    test(
        'Slow test - Intentional delay',
        {
            annotation: {
                type: 'team',
                description: 'Performance',
            },
        },
        async ({page}) => {
            // Visit Wikipedia
            await page.goto('https://www.wikipedia.org');

            // Wait to make this a slow test
            await page.waitForTimeout(6000);

            // Verify the title
            await expect(page).toHaveTitle(/Wikipedia/);
        },
    );
});
