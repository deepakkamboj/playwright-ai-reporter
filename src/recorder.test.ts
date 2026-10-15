import assert from 'node:assert/strict';
import {maskBody, maskHeaders, maskUrl} from './recorder';
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
