import assert from 'node:assert/strict';
import type {APIRequestContext, APIResponse} from '@playwright/test';
import {maskBody, maskHeaders, maskUrl, recordApiRequest} from './recorder';
import {test} from 'node:test';

test('sensitive headers are masked and others are kept', () => {
    const masked = maskHeaders({Authorization: 'Bearer abc', 'X-Api-Key': 'k', 'Set-Cookie': 'a=b', Accept: 'json'});

    assert.deepEqual(masked, {Authorization: '****', 'X-Api-Key': '****', 'Set-Cookie': '****', Accept: 'json'});
});

test('sensitive query parameters are masked in URLs', () => {
    const url = maskUrl('https://x.test/path?page=2&access_token=secret&api_key=k');

    assert.match(url, /page=2/);
    assert.doesNotMatch(url, /secret/);
    assert.doesNotMatch(url, /api_key=k/);
});

test('sensitive keys are masked at any depth of a JSON body', () => {
    const body = maskBody(JSON.stringify({user: 'a', password: 'p', nested: [{token: 't', ok: 1}]}));

    assert.match(body ?? '', /"user": "a"/);
    assert.match(body ?? '', /"password": "\*\*\*\*"/);
    assert.match(body ?? '', /"token": "\*\*\*\*"/);
    assert.doesNotMatch(body ?? '', /"p"|"t"/);
});

test('non-JSON bodies are kept and long ones are truncated', () => {
    assert.equal(maskBody('<html></html>'), '<html></html>');
    assert.equal(maskBody(''), undefined);
    assert.match(maskBody('x'.repeat(10_000)) ?? '', /\(truncated\)$/);
});

test('APIRequestContext wrapper records and redacts requests without changing the original', async () => {
    const secret = 'request-secret-123456789';
    const response = {
        url: () => `https://api.test/users?token=${secret}`,
        status: () => 201,
        headers: () => ({'set-cookie': `session=${secret}`, 'content-type': 'application/json'}),
        text: async () => JSON.stringify({password: secret, ok: true}),
    } as unknown as APIResponse;
    const originalCalls: unknown[][] = [];
    const context = {
        post: async (...args: unknown[]) => {
            originalCalls.push(args);
            return response;
        },
        storageState: async () => ({cookies: [], origins: []}),
    } as unknown as APIRequestContext;
    const recorder = recordApiRequest(context);

    const returned = await recorder.request.post(`https://api.test/users?token=${secret}`, {
        headers: {Authorization: `Bearer ${secret}`, Accept: 'application/json'},
        data: {password: secret, name: 'Ada'},
    });
    const state = await recorder.request.storageState();

    assert.equal(returned, response);
    assert.equal(originalCalls.length, 1);
    assert.deepEqual(state, {cookies: [], origins: []});
    assert.equal(recorder.calls.length, 1);
    assert.equal(recorder.calls[0]?.method, 'POST');
    assert.equal(recorder.calls[0]?.status, 201);
    assert.doesNotMatch(JSON.stringify(recorder.calls), new RegExp(secret));
    assert.match(recorder.calls[0]?.requestBody ?? '', /"name": "Ada"/);
});

test('APIRequestContext wrapper records failures and rethrows them', async () => {
    const context = {
        get: async () => {
            throw new Error('Bearer failed-request-secret-123456789');
        },
    } as unknown as APIRequestContext;
    const recorder = recordApiRequest(context);

    await assert.rejects(() => recorder.request.get('https://api.test/fail'), /failed-request-secret/);

    assert.equal(recorder.calls[0]?.status, 0);
    assert.doesNotMatch(recorder.calls[0]?.failure ?? '', /failed-request-secret/);
});

test('response evidence failures are warned and do not change the request result', async () => {
    const secret = 'response-secret-123456789';
    const response = {
        url: () => 'https://api.test/stream',
        status: () => 200,
        headers: () => ({}),
        text: async () => {
            throw new Error(`cannot read Bearer ${secret}`);
        },
    } as unknown as APIResponse;
    const context = {get: async () => response} as unknown as APIRequestContext;
    const recorder = recordApiRequest(context);
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);

    try {
        assert.equal(await recorder.request.get('https://api.test/stream'), response);
    } finally {
        console.warn = originalWarn;
    }

    assert.equal(recorder.calls[0]?.status, 200);
    assert.match(warnings.join('\n'), /could not capture the API response body/);
    assert.doesNotMatch(warnings.join('\n'), new RegExp(secret));
});
