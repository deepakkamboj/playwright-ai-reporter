import assert from 'node:assert/strict';
import test from 'node:test';
import {REDACTED, redactHeaders, redactJson, redactText, redactUrl, redactValue, registerSecret} from './redaction';

test('redacts sensitive structured keys and propagates learned values', () => {
    const secret = 'unique-secret-value-314159';
    const value = redactValue({
        before: secret,
        credentials: {password: secret},
        after: `repeated ${secret}`,
        safe: 'visible',
    });

    assert.deepEqual(value, {
        before: REDACTED,
        credentials: {password: REDACTED},
        after: `repeated ${REDACTED}`,
        safe: 'visible',
    });
});

test('redacts sensitive environment values from unrelated text', () => {
    const secret = 'environment-secret-271828';
    process.env.TEST_CLIENT_SECRET = secret;
    try {
        assert.equal(redactText(`failure included ${secret}`), `failure included ${REDACTED}`);
    } finally {
        delete process.env.TEST_CLIENT_SECRET;
    }
});

test('redacts common token, authorization, JWT, and card formats', () => {
    const text = [
        'Bearer abcdefghijklmnop',
        'Basic YWxhZGRpbjpvcGVuc2VzYW1l',
        'github_pat_1234567890abcdefghijklmnop',
        'sk-proj-1234567890abcdefghijklmnop',
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature',
        '4111 1111 1111 1111',
    ].join('\n');

    const redacted = redactText(text);
    assert.doesNotMatch(redacted, /abcdefghijklmnop|YWxhZGRpb|eyJhbGci|4111/);
    assert.equal(redacted.match(/\*\*\*\*/g)?.length, 6);
});

test('learns webhook environment credentials before providers are created', () => {
    const value = 'https://hooks.example.test/services/private-webhook-credential';
    const previous = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = value;
    try {
        assert.equal(redactText(`failure included ${value}`), `failure included ${REDACTED}`);
        assert.deepEqual(redactValue({webhookUrl: value, repeated: value}), {
            webhookUrl: REDACTED,
            repeated: REDACTED,
        });
    } finally {
        if (previous === undefined) delete process.env.SLACK_WEBHOOK_URL;
        else process.env.SLACK_WEBHOOK_URL = previous;
    }
});

test('does not mask an invalid payment-card candidate', () => {
    assert.equal(redactText('reference 4111 1111 1111 1112'), 'reference 4111 1111 1111 1112');
});

test('redacts URL credentials, query parameters, and headers', () => {
    const url = redactUrl('https://alice:password@example.test/path?access_token=token-value&page=2');
    const headers = redactHeaders({
        Authorization: 'Bearer header-secret',
        'X-Api-Key': 'api-key-value',
        Accept: 'safe',
    });

    assert.doesNotMatch(url, /alice|password|token-value/);
    assert.match(url, /page=2/);
    assert.deepEqual(headers, {Authorization: REDACTED, 'X-Api-Key': REDACTED, Accept: 'safe'});
});

test('redacts key-value text and explicitly registered values', () => {
    registerSecret('registered-value-161803');
    const redacted = redactText('password="quoted-value" api_key=bare-value repeated registered-value-161803');

    assert.equal(redacted, `password=${REDACTED} api_key=${REDACTED} repeated ${REDACTED}`);
});

test('redacted JSON handles nested values and circular references', () => {
    const value: {token: string; child?: unknown} = {token: 'json-secret'};
    value.child = value;
    const json = redactJson(value, 2);

    assert.doesNotMatch(json, /json-secret/);
    assert.match(json, /"token": "\*\*\*\*"/);
    assert.match(json, /\[Circular\]/);
});
