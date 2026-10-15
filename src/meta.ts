/**
 * Lets a test declare facts about itself that the report and the bug it files then show:
 * priority, severity, owner, feature, linked issues, and anything else you want to track.
 *
 *     import {meta} from 'playwright-ai-reporter/meta';
 *
 *     test('submits the contact form', async ({page}) => {
 *         await meta({priority: 'P1', severity: 'major', owner: 'forms-qa', feature: 'contact-form'});
 *         ...
 *     });
 *
 * The values travel as a JSON attachment named "meta", so they also appear in Playwright's own HTML
 * report. The reporter reads them from the final attempt of the test. An "owner" replaces the team
 * the reporter would otherwise guess from the test title.
 */

import {test} from '@playwright/test';

/** Accepts the usual values for editor completion, and any other string for your own scale. */
type Loose<T extends string> = T | (string & Record<never, never>);

export interface TestMeta {
    priority?: Loose<'P0' | 'P1' | 'P2' | 'P3' | 'P4'>;
    severity?: Loose<'blocker' | 'critical' | 'major' | 'minor' | 'trivial'>;
    owner?: string;
    feature?: string;
    story?: string | string[];
    issue?: string | string[];
    testCaseId?: string;
    [key: string]: string | number | boolean | (string | number)[] | Record<string, string | number> | undefined;
}

/** The attachment name the reporter looks for. */
export const META_ATTACHMENT_NAME = 'meta';

export async function meta(values: TestMeta): Promise<void> {
    const defined = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

    await test.info().attach(META_ATTACHMENT_NAME, {
        body: Buffer.from(JSON.stringify(defined, null, 2)),
        contentType: 'application/json',
    });
}
