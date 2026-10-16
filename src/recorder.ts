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
import type {APIRequestContext, APIResponse, BrowserContext, Page, Request} from '@playwright/test';
import type {ApiCall} from './types';
import {redactHeaders, redactJson, redactText, redactUrl, redactValue} from './utils/redaction';
import {API_ATTACHMENT_NAME} from './utils/testReportData';

export type {ApiCall};

const MAX_CALLS = 100;
const MAX_BODY_CHARACTERS = 4000;

export interface ApiRecorder {
    readonly calls: ApiCall[];
    /** Attaches the recorded calls to the running test. Safe to call more than once. */
    attach(): Promise<void>;
}

export interface ApiRequestRecorder extends ApiRecorder {
    /** A local proxy around this context. The original Playwright prototype is never modified. */
    readonly request: APIRequestContext;
}

export interface RecordApiOptions {
    /** Which calls to keep. Defaults to everything the page sends with fetch or XHR. */
    filter?: (url: string, resourceType: string) => boolean;
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
    return redactHeaders(headers);
}

export function maskUrl(rawUrl: string): string {
    return redactUrl(rawUrl);
}

/** Masks sensitive keys when the body is JSON; other bodies (HTML, text) are only truncated. */
export function maskBody(body: string | null | undefined): string | undefined {
    if (!body) return undefined;
    let text = body;
    try {
        text = JSON.stringify(redactValue(JSON.parse(body)), null, 2);
    } catch {
        text = redactText(body);
    }
    return text.length > MAX_BODY_CHARACTERS ? `${text.slice(0, MAX_BODY_CHARACTERS)}... (truncated)` : text;
}

const isApi = (request: Request): boolean => ['fetch', 'xhr'].includes(request.resourceType());

const REQUEST_METHODS = new Set(['fetch', 'get', 'post', 'put', 'patch', 'delete', 'head']);

function requestHeaders(options: unknown): Record<string, string> {
    if (!options || typeof options !== 'object' || !('headers' in options)) return {};
    const headers = options.headers;
    if (Array.isArray(headers)) {
        return Object.fromEntries(
            headers
                .filter(
                    (header): header is {name: string; value: string} =>
                        Boolean(header) &&
                        typeof header === 'object' &&
                        typeof header.name === 'string' &&
                        typeof header.value === 'string',
                )
                .map((header) => [header.name, header.value]),
        );
    }
    if (!headers || typeof headers !== 'object') return {};
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));
}

function requestBody(options: unknown): string | undefined {
    if (!options || typeof options !== 'object') return undefined;
    const values = options as Record<string, unknown>;
    for (const key of ['data', 'form', 'multipart'] as const) {
        if (!(key in values) || values[key] === undefined) continue;
        const value = values[key];
        if (typeof value === 'string') return maskBody(value);
        if (Buffer.isBuffer(value)) return maskBody(value.toString('utf8'));
        return maskBody(redactJson(value));
    }
    return undefined;
}

function inputUrl(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'url' in value && typeof value.url === 'function') {
        return String(value.url());
    }
    return 'unknown-request';
}

function methodName(property: string, options: unknown, input: unknown): string {
    if (property !== 'fetch') return property.toUpperCase();
    if (options && typeof options === 'object' && 'method' in options && typeof options.method === 'string') {
        return options.method.toUpperCase();
    }
    if (input && typeof input === 'object' && 'method' in input && typeof input.method === 'function') {
        return String(input.method()).toUpperCase();
    }
    return 'GET';
}

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
            ...(failure ? {failure: redactText(failure)} : {}),
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
            body: Buffer.from(redactJson(calls, 2)),
            contentType: 'application/json',
        });
    };

    return {calls, attach};
}

/**
 * Wraps an APIRequestContext without changing Playwright globals or prototypes.
 *
 * Use recorder.request for requests that should be captured. Calls made through the original
 * context are intentionally untouched.
 */
export function recordApiRequest(context: APIRequestContext, options: RecordApiOptions = {}): ApiRequestRecorder {
    const calls: ApiCall[] = [];
    let attached = false;

    const request = new Proxy(context, {
        get(target, property) {
            const original = Reflect.get(target, property, target);
            if (typeof property !== 'string' || !REQUEST_METHODS.has(property) || typeof original !== 'function') {
                return typeof original === 'function' ? original.bind(target) : original;
            }

            return async (...args: unknown[]): Promise<APIResponse> => {
                const started = Date.now();
                const optionsValue = args[1];
                const originalUrl = inputUrl(args[0]);
                const method = methodName(property, optionsValue, args[0]);
                let response: APIResponse;

                try {
                    response = (await Reflect.apply(original, target, args)) as APIResponse;
                } catch (error) {
                    if (calls.length < MAX_CALLS && (!options.filter || options.filter(originalUrl, 'api-request'))) {
                        const bodySent = requestBody(optionsValue);
                        calls.push({
                            method,
                            url: maskUrl(originalUrl),
                            status: 0,
                            durationMs: Date.now() - started,
                            failure: redactText(error instanceof Error ? error.message : String(error)),
                            requestHeaders: maskHeaders(requestHeaders(optionsValue)),
                            responseHeaders: {},
                            ...(bodySent ? {requestBody: bodySent} : {}),
                        });
                    }
                    throw error;
                }

                const url = response.url() || originalUrl;
                if (calls.length < MAX_CALLS && (!options.filter || options.filter(url, 'api-request'))) {
                    let body: string | undefined;
                    try {
                        body = maskBody(await response.text());
                    } catch (error) {
                        console.warn(
                            `playwright-ai-reporter could not capture the API response body: ${redactText(
                                error instanceof Error ? error.message : String(error),
                            )}`,
                        );
                    }
                    const bodySent = requestBody(optionsValue);
                    calls.push({
                        method,
                        url: maskUrl(url),
                        status: response.status(),
                        durationMs: Date.now() - started,
                        requestHeaders: maskHeaders(requestHeaders(optionsValue)),
                        responseHeaders: maskHeaders(response.headers()),
                        ...(bodySent ? {requestBody: bodySent} : {}),
                        ...(body ? {responseBody: body} : {}),
                    });
                }
                return response;
            };
        },
    });

    const attach = async (): Promise<void> => {
        if (attached) return;
        attached = true;
        if (calls.length === 0) return;
        await test.info().attach(API_ATTACHMENT_NAME, {
            body: Buffer.from(redactJson(calls, 2)),
            contentType: 'application/json',
        });
    };

    return {calls, request, attach};
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
            try {
                await use();
            } finally {
                await recorder.attach();
            }
        },
        {auto: true},
    ] as const,
};

/** Opt-in fixture: request through `recordedRequest` instead of Playwright's original `request`. */
export const apiRequestRecorderFixture = {
    recordedRequest: async (
        {request}: {request: APIRequestContext},
        use: (request: APIRequestContext) => Promise<void>,
    ) => {
        const recorder = recordApiRequest(request);
        try {
            await use(recorder.request);
        } finally {
            await recorder.attach();
        }
    },
};
