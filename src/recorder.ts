/**
 * Records the API calls a page makes during a test, so the report can show them next to the failure.
 *
 *     import {recordApi} from 'playwright-ai-reporter/recorder';
 *
 *     const api = recordApi(page);
 *     ...
 *     await api.attach();
 *
 * or, to record every test without touching it, add the fixture to your own `test`:
 *
 *     import {apiRecorderFixture} from 'playwright-ai-reporter/recorder';
 *     export const test = base.extend({...apiRecorderFixture});
 *
 * Only fetch and XHR calls are recorded. Secrets are masked before anything is stored: sensitive
 * headers, sensitive JSON keys and sensitive query parameters are replaced with "****".
 */

import {test} from '@playwright/test';
import type {BrowserContext, Page, Request} from '@playwright/test';
import type {ApiCall} from './types';
import {API_ATTACHMENT_NAME} from './utils/testReportData';

export type {ApiCall};

const MASK = '****';
const MAX_CALLS = 100;
const MAX_BODY_CHARACTERS = 4000;
const SENSITIVE = /authorization|cookie|token|secret|password|passwd|api[-_]?key|session|credential/i;

export interface ApiRecorder {
    readonly calls: ApiCall[];
    /** Attaches the recorded calls to the running test. Safe to call more than once. */
    attach(): Promise<void>;
}

export interface RecordApiOptions {
    /** Which calls to keep. Defaults to everything the page sends with fetch or XHR. */
    filter?: (url: string, resourceType: string) => boolean;
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, SENSITIVE.test(key) ? MASK : value]));
}

export function maskUrl(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        for (const key of [...url.searchParams.keys()]) {
            if (SENSITIVE.test(key)) url.searchParams.set(key, MASK);
        }
        return url.toString();
    } catch {
        return rawUrl;
    }
}

const maskValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(maskValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [key, SENSITIVE.test(key) ? MASK : maskValue(inner)]),
        );
    }
    return value;
};

/** Masks sensitive keys when the body is JSON; other bodies (HTML, text) are only truncated. */
export function maskBody(body: string | null | undefined): string | undefined {
    if (!body) return undefined;
    let text = body;
    try {
        text = JSON.stringify(maskValue(JSON.parse(body)), null, 2);
    } catch {
        // Not JSON
    }
    return text.length > MAX_BODY_CHARACTERS ? `${text.slice(0, MAX_BODY_CHARACTERS)}... (truncated)` : text;
}

const isApi = (request: Request): boolean => ['fetch', 'xhr'].includes(request.resourceType());

/** Starts recording the calls of a page or browser context. */
export function recordApi(target: Page | BrowserContext, options: RecordApiOptions = {}): ApiRecorder {
    const calls: ApiCall[] = [];
    const started = new Map<Request, number>();
    const pending = new Set<Promise<void>>();
    let attached = false;

    const keep = (request: Request): boolean =>
        isApi(request) && (options.filter ? options.filter(request.url(), request.resourceType()) : true);

    target.on('request', (request) => {
        if (keep(request)) started.set(request, Date.now());
    });

    const finish = async (request: Request, failure?: string): Promise<void> => {
        const begin = started.get(request);
        if (begin === undefined || calls.length >= MAX_CALLS) return;
        started.delete(request);

        let status = 0;
        let responseHeaders: Record<string, string> = {};
        let responseBody: string | undefined;
        try {
            const response = await request.response();
            if (response) {
                status = response.status();
                responseHeaders = await response.allHeaders();
                responseBody = maskBody(await response.text());
            }
        } catch {
            // The body is gone (redirect, closed page): the call itself is still worth showing
        }

        calls.push({
            method: request.method(),
            url: maskUrl(request.url()),
            status,
            durationMs: Date.now() - begin,
            ...(failure ? {failure} : {}),
            requestHeaders: maskHeaders(request.headers()),
            responseHeaders: maskHeaders(responseHeaders),
            ...(request.postData() ? {requestBody: maskBody(request.postData())} : {}),
            ...(responseBody ? {responseBody} : {}),
        });
    };

    const track = (work: Promise<void>): void => {
        pending.add(work);
        void work.finally(() => pending.delete(work));
    };

    target.on('requestfinished', (request) => track(finish(request)));
    target.on('requestfailed', (request) => track(finish(request, request.failure()?.errorText ?? 'Request failed')));

    const attach = async (): Promise<void> => {
        if (attached) return;
        attached = true;
        await Promise.allSettled([...pending]);
        if (calls.length === 0) return;
        await test.info().attach(API_ATTACHMENT_NAME, {
            body: Buffer.from(JSON.stringify(calls, null, 2)),
            contentType: 'application/json',
        });
    };

    return {calls, attach};
}

/**
 * An automatic fixture: every test then records its page's API calls and attaches them when it ends,
 * whether it passed or failed.
 *
 *     export const test = base.extend({...apiRecorderFixture});
 */
export const apiRecorderFixture = {
    apiRecorder: [
        async ({page}: {page: Page}, use: () => Promise<void>) => {
            const recorder = recordApi(page);
            await use();
            await recorder.attach();
        },
        {auto: true},
    ] as const,
};
