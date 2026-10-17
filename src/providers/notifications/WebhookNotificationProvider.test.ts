import assert from 'node:assert/strict';
import {test, TestContext} from 'node:test';
import {SlackNotificationProvider} from './SlackNotificationProvider';
import {TeamsNotificationProvider} from './TeamsNotificationProvider';
import {NotificationFactory} from '../factories/NotificationFactory';
import {ProviderRegistry} from '../ProviderRegistry';
import {TestFailure, TestSummary} from '../../types';
import {runDoctor} from '../../utils/onboarding';
import {ReporterWorkflow} from '../../examples/ReporterWorkflow';
import {redactJson} from '../../utils/redaction';

const webhookUrl = 'https://hooks.example.test/private/notification-credential';
const options = {recipients: []};
const failure = (title: string): TestFailure => ({
    testTitle: title,
    suiteTitle: 'suite',
    owningTeam: 'quality',
    errorMessage: 'assertion failed',
    errorStack: '',
    duration: 1,
    isTimeout: false,
    errorCategory: 'Assertion',
});
const summary = (failures: TestFailure[] = []): TestSummary => ({
    failures,
    testCount: 8 + failures.length,
    passedCount: 7,
    failedCount: failures.length,
    skippedCount: 1,
    totalTimeDisplay: '12 seconds',
    averageTime: 1,
    slowestTest: 2,
    slowestTests: [],
});

function capture(t: TestContext, status = 200, body = 'ok') {
    const calls: Array<{url: string; init?: RequestInit}> = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({url: String(input), init});
        return new Response(body, {status});
    });
    return calls;
}

test('Slack sends Block Kit counts, bounded failure titles, and an explicit report link', async (t) => {
    const calls = capture(t);
    const provider = new SlackNotificationProvider({webhookUrl});
    const failures = Array.from({length: 7}, (_, index) => failure(`failure-${index} ${'x'.repeat(300)}`));
    const result = await provider.sendTestSummary(summary(failures), {
        ...options,
        flakyCount: 1,
        reportUrl: 'https://reports.example.test/run/',
    });
    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, webhookUrl);
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[0].init?.redirect, 'error');
    const payload = JSON.parse(String(calls[0].init?.body));
    assert.equal(payload.blocks[0].type, 'header');
    assert.equal(payload.blocks[0].text.type, 'plain_text');
    assert.deepEqual(payload.blocks[1].fields.slice(0, 4), [
        {type: 'plain_text', text: 'Total: 15'},
        {type: 'plain_text', text: 'Passed: 6'},
        {type: 'plain_text', text: 'Failed: 7'},
        {type: 'plain_text', text: 'Flaky: 1'},
    ]);
    assert.equal(payload.blocks[2].text.text.length, 200);
    assert.doesNotMatch(JSON.stringify(payload), /failure-5|failure-6/);
    assert.match(JSON.stringify(payload), /and 2 more failed tests/);
    assert.equal(payload.blocks.at(-1).elements[0].url, 'https://reports.example.test/run/');
    assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 28_000);
});

test('Teams sends a Workflows-compatible Adaptive Card and accepts HTTP 202', async (t) => {
    const calls = capture(t, 202, '');
    const provider = new TeamsNotificationProvider({webhookUrl});
    assert.equal(
        (await provider.sendTestSummary(summary([failure('[unsafe](https://unwanted.test)')]), options)).success,
        true,
    );
    const payload = JSON.parse(String(calls[0].init?.body));
    assert.equal(payload.type, 'message');
    assert.equal(payload.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
    const card = payload.attachments[0].content;
    assert.equal(card.type, 'AdaptiveCard');
    assert.equal(card.version, '1.2');
    assert.equal(card.body[1].type, 'FactSet');
    assert.match(card.body[2].text, /\\\[unsafe\\\]/);
    assert.equal(card.actions, undefined);
});

test('webhook credentials and learned secrets are redacted from all public notification methods', async (t) => {
    const calls = capture(t);
    const provider = new SlackNotificationProvider({webhookUrl});
    const secret = 'notification-secret-987654321';
    await provider.sendCustomNotification(`password=${secret}`, `repeated ${secret}; ${webhookUrl}`, options);
    await provider.sendTestFailures([failure(`failure ${secret}`)], options);
    await provider.sendNotification({subject: `summary ${secret}`, body: webhookUrl, recipients: []});
    const bodies = calls.map((call) => call.init?.body).join('\n');
    assert.doesNotMatch(bodies, new RegExp(secret));
    assert.ok(!bodies.includes(webhookUrl));
    assert.match(bodies, /\*\*\*\*/);
});

test('empty runs have explicit zero totals without NaN, and details can be omitted', async (t) => {
    const calls = capture(t);
    const provider = new SlackNotificationProvider({webhookUrl});
    await provider.sendTestSummary(
        {...summary([failure('hidden failure')]), testCount: 0, passedCount: 0, failedCount: 0, skippedCount: 0},
        {...options, includeDetails: false, runStatus: 'interrupted'},
    );
    const body = String(calls[0].init?.body);
    assert.match(body, /INTERRUPTED/);
    assert.match(body, /Total: 0/);
    assert.doesNotMatch(body, /NaN|Infinity|hidden failure/);
});

test('rejects insecure, malformed, credential-bearing, or fragment-bearing webhook URLs without echoing them', () => {
    for (const url of [
        'http://hooks.test/secret',
        'invalid-secret',
        'https://user:secret@hooks.test',
        'https://hooks.test/#secret',
    ]) {
        assert.throws(
            () => new SlackNotificationProvider({webhookUrl: url}),
            (cause: unknown) => {
                assert.ok(cause instanceof Error);
                assert.ok(!cause.message.includes(url));
                return true;
            },
        );
    }
});

test('HTTP rejection returns an explicit safe failure and is not retried', async (t) => {
    const calls = capture(t, 429, webhookUrl);
    const log = t.mock.method(console, 'error', () => undefined);
    const result = await new SlackNotificationProvider({webhookUrl}).sendTestSummary(summary(), options);
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /HTTP 429/);
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(log.mock.calls).includes(webhookUrl));
});

test('network and redirect failures never log the raw HTTP-client error', async (t) => {
    const log = t.mock.method(console, 'error', () => undefined);
    t.mock.method(globalThis, 'fetch', async () => {
        throw new Error(`Failed to fetch ${webhookUrl}`);
    });
    const result = await new TeamsNotificationProvider({webhookUrl}).sendTestSummary(summary(), options);
    assert.equal(result.success, false);
    assert.ok(!JSON.stringify({result, logs: log.mock.calls}).includes(webhookUrl));
});

test('uses a ten-second deadline and reports timeout explicitly', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    const timeout = t.mock.method(AbortSignal, 'timeout', () => AbortSignal.abort());
    t.mock.method(globalThis, 'fetch', async () => {
        throw new DOMException('secret endpoint must not be logged', 'TimeoutError');
    });
    const result = await new TeamsNotificationProvider({webhookUrl}).sendTestSummary(summary(), options);
    assert.equal(timeout.mock.calls[0].arguments[0], 10_000);
    assert.match(result.error ?? '', /timed out after 10 seconds/);
});

test('Slack requires an acknowledgement, and uploads or unsafe report links do not succeed', async (t) => {
    const calls = capture(t, 200, 'invalid_payload');
    t.mock.method(console, 'error', () => undefined);
    const provider = new SlackNotificationProvider({webhookUrl});
    assert.equal((await provider.sendTestSummary(summary(), options)).success, false);
    assert.equal((await provider.sendTestSummary(summary(), {...options, attachments: ['secret.txt']})).success, false);
    assert.equal(
        (await provider.sendTestSummary(summary(), {...options, reportUrl: 'http://reports.test/'})).success,
        false,
    );
    assert.equal(calls.length, 1);
});

test('factory and registry support explicit config, environment fallback, and independent caches', async () => {
    const previous = process.env.TEAMS_WEBHOOK_URL;
    process.env.TEAMS_WEBHOOK_URL = 'https://teams.example.test/private/teams-credential';
    ProviderRegistry.reset();
    try {
        await ProviderRegistry.initialize({notification: {type: 'slack', config: {webhookUrl}}});
        const slack = await ProviderRegistry.getNotificationProvider('slack');
        const teams = await ProviderRegistry.getNotificationProvider('teams');
        assert.ok(slack instanceof SlackNotificationProvider);
        assert.ok(teams instanceof TeamsNotificationProvider);
        assert.equal(await ProviderRegistry.getNotificationProvider('slack'), slack);
        assert.equal(await ProviderRegistry.getNotificationProvider('teams'), teams);
    } finally {
        ProviderRegistry.reset();
        if (previous === undefined) delete process.env.TEAMS_WEBHOOK_URL;
        else process.env.TEAMS_WEBHOOK_URL = previous;
    }
});

test('explicit webhook credentials are redacted as soon as registry configuration is accepted', async () => {
    const raw = 'https://HOOKS.example.test/config/../early/explicit-credential-2847';
    const normalized = new URL(raw).href;
    const previous = process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;
    ProviderRegistry.reset();
    try {
        await ProviderRegistry.initialize({notification: {type: 'slack', config: {webhookUrl: raw}}});
        const serialized = redactJson({errorMessage: `request included ${raw} and ${normalized}`});
        assert.ok(!serialized.includes(raw), 'Raw webhook credential leaked before provider initialization');
        assert.ok(
            !serialized.includes(normalized),
            'Normalized webhook credential leaked before provider initialization',
        );
    } finally {
        ProviderRegistry.reset();
        if (previous === undefined) delete process.env.SLACK_WEBHOOK_URL;
        else process.env.SLACK_WEBHOOK_URL = previous;
    }
});

test('workflow example reports rejected notifications instead of logging success', async (t) => {
    const previous = process.env.ENABLE_NOTIFICATIONS;
    process.env.ENABLE_NOTIFICATIONS = 'true';
    t.after(() => {
        if (previous === undefined) delete process.env.ENABLE_NOTIFICATIONS;
        else process.env.ENABLE_NOTIFICATIONS = previous;
    });
    const logs = t.mock.method(console, 'log', () => undefined);
    const errors = t.mock.method(console, 'error', () => undefined);
    const provider = new SlackNotificationProvider({webhookUrl});
    t.mock.method(provider, 'sendNotification', async () => ({success: false, error: 'HTTP 403'}));
    t.mock.method(ProviderRegistry, 'getNotificationProvider', async () => provider);
    await ReporterWorkflow.sendNotification({failedTests: 1, totalTests: 1}, []);
    assert.equal(logs.mock.callCount(), 0);
    assert.match(String(errors.mock.calls[0].arguments), /Notification failed.*HTTP 403/);
});

test('factory validates explicit configuration and missing environment values', async () => {
    assert.ok((await NotificationFactory.createProvider('slack', {webhookUrl})) instanceof SlackNotificationProvider);
    assert.ok((await NotificationFactory.createProvider('teams', {webhookUrl})) instanceof TeamsNotificationProvider);
    await assert.rejects(NotificationFactory.createProvider('slack', {webhookUrl: ''}), /SLACK_WEBHOOK_URL/);
    await assert.rejects(NotificationFactory.createProvider('teams', {webhookUrl: 123}), /TEAMS_WEBHOOK_URL/);
    const raw = 'https://HOOKS.example.test/factory/../explicit/factory-credential-4962';
    await NotificationFactory.createProvider('slack', {webhookUrl: raw});
    const serialized = redactJson({raw, normalized: new URL(raw).href});
    assert.ok(!serialized.includes(raw));
    assert.ok(!serialized.includes(new URL(raw).href));
});

test('doctor recognizes chat providers and validates configured URLs without disclosing them', () => {
    const checks = runDoctor('.', {
        cwd: process.cwd(),
        packageRoot: process.cwd(),
        nodeVersion: 'v22.0.0',
        env: {
            NOTIFICATION_PROVIDER: 'slack',
            SLACK_WEBHOOK_URL: webhookUrl,
            TEAMS_WEBHOOK_URL: 'http://teams.test/private-secret',
        },
        playwright: () => ({packagePath: __filename, browserPath: __filename}),
    });
    assert.equal(checks.find((check) => check.name === 'NOTIFICATION_PROVIDER=slack')?.ok, true);
    assert.equal(checks.find((check) => check.name === 'SLACK_WEBHOOK_URL')?.ok, true);
    assert.equal(checks.find((check) => check.name === 'TEAMS_WEBHOOK_URL')?.ok, false);
    assert.ok(!JSON.stringify(checks).includes(webhookUrl));
    assert.doesNotMatch(JSON.stringify(checks), /private-secret/);
});
