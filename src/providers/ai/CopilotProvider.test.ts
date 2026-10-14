import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {AIProviderFactory} from './AIProviderFactory';
import {CliResult, CliRunner, COPILOT_TEXT_ONLY_ARGS, CopilotProvider} from './CopilotProvider';

interface Call {
    command: string;
    args: string[];
    input: string;
    timeoutMs: number;
}

function fakeRunner(result: CliResult | Error, calls: Call[] = []): CliRunner {
    return async (command, args, input, options) => {
        calls.push({command, args, input, timeoutMs: options.timeoutMs});
        if (result instanceof Error) {
            throw result;
        }
        return result;
    };
}

const ok = (stdout: string): CliResult => ({stdout, stderr: '', exitCode: 0});

const savedEnv = {...process.env};
afterEach(() => {
    process.env = {...savedEnv};
});

test('sends the prompt on stdin with every tool disabled', async () => {
    const calls: Call[] = [];
    const provider = new CopilotProvider(fakeRunner(ok('  analysis text \n'), calls));

    const response = await provider.generateCompletion([
        {role: 'system', content: 'You are a test engineer.'},
        {role: 'user', content: 'Why did it fail?'},
    ]);

    assert.equal(response.content, 'analysis text');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.args, COPILOT_TEXT_ONLY_ARGS);
    assert.equal(calls[0]?.input, 'You are a test engineer.\n\nWhy did it fail?');
    assert.ok(COPILOT_TEXT_ONLY_ARGS.includes('--available-tools'));
    assert.ok(!COPILOT_TEXT_ONLY_ARGS.includes('--allow-all-tools'));
});

test('passes a validated model through', async () => {
    process.env.COPILOT_MODEL = 'gpt-5.4';
    const calls: Call[] = [];
    const provider = new CopilotProvider(fakeRunner(ok('x'), calls));

    await provider.generateText('hi');

    assert.deepEqual(calls[0]?.args.slice(-2), ['--model', 'gpt-5.4']);
});

test('rejects a model name that could inject arguments', async () => {
    const provider = new CopilotProvider(fakeRunner(ok('x')));

    await assert.rejects(() => provider.generateText('hi', {model: 'gpt; rm -rf /'}), /Invalid Copilot model/);
});

test('asks for JSON when requested', async () => {
    const calls: Call[] = [];
    const provider = new CopilotProvider(fakeRunner(ok('{}'), calls));

    await provider.generateText('hi', {responseFormat: 'json'});

    assert.match(calls[0]?.input ?? '', /single valid JSON object/);
});

test('a failing CLI is an error, not a response', async () => {
    const provider = new CopilotProvider(fakeRunner({stdout: '', stderr: 'not authenticated', exitCode: 1}));

    await assert.rejects(() => provider.generateText('hi'), /Copilot CLI failed: not authenticated/);
});

test('an empty response is an error', async () => {
    const provider = new CopilotProvider(fakeRunner(ok('  \n')));

    await assert.rejects(() => provider.generateText('hi'), /empty response/);
});

test('initialize explains how to install and authenticate when the CLI is missing', async () => {
    const provider = new CopilotProvider(fakeRunner(new Error('spawn copilot ENOENT')));

    await assert.rejects(() => provider.initialize(), /npm install -g @github\/copilot[\s\S]*copilot-requests: write/);
});

test('initialize succeeds when the CLI reports its version', async () => {
    const calls: Call[] = [];
    const provider = new CopilotProvider(fakeRunner(ok('GitHub Copilot CLI 1.0.0'), calls));

    await provider.initialize();

    assert.deepEqual(calls[0]?.args, ['--version']);
});

test('timeout and command can be configured from the environment', async () => {
    process.env.COPILOT_CLI_PATH = '/opt/copilot';
    process.env.COPILOT_TIMEOUT_MS = '1234';
    const calls: Call[] = [];
    const provider = new CopilotProvider(fakeRunner(ok('x'), calls));

    await provider.generateText('hi');

    assert.equal(calls[0]?.command, '/opt/copilot');
    assert.equal(calls[0]?.timeoutMs, 1234);
});

test('is selectable as AI_PROVIDER=copilot', () => {
    assert.ok(AIProviderFactory.isProviderSupported('copilot'));
});
