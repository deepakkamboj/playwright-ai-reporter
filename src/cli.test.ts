import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {CliRuntime, runCli} from './cli';

test('prints help and reports invalid merge arguments', () => {
    const output: string[] = [];
    const errors: string[] = [];
    const streams = {out: (message: string) => output.push(message), error: (message: string) => errors.push(message)};

    assert.equal(runCli(['--help'], streams), 0);
    assert.match(output.join('\n'), /merge <shard-dir>/);
    assert.match(output.join('\n'), /doctor/);
    assert.equal(runCli(['merge', 'only-one', '--output', 'merged'], streams), 1);
    assert.match(errors.join('\n'), /at least two shard directories/);
    assert.equal(runCli(['merge', 'one', 'two', '-o', 'first', '--output', 'second'], streams), 1);
    assert.match(errors.join('\n'), /accepts --output only once/);
    assert.equal(runCli(['unknown'], streams), 1);
    assert.match(errors.join('\n'), /Unknown command/);
});

function healthyRuntime(directory: string, env: NodeJS.ProcessEnv = {}): CliRuntime {
    const outputs = [
        path.join('dist', 'reporter.js'),
        path.join('dist', 'cli.js'),
        path.join('dist', 'templates', 'test-health-report.html'),
        path.join('dist', 'templates', 'test-health-report.css'),
        path.join('dist', 'templates', 'test-health-report.js'),
        path.join('browsers', 'chromium.exe'),
    ];
    for (const output of outputs) {
        const file = path.join(directory, output);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, '');
    }
    return {
        cwd: directory,
        env,
        nodeVersion: 'v22.14.0',
        packageRoot: directory,
        playwright: () => ({
            packagePath: path.join(directory, 'node_modules', '@playwright', 'test', 'package.json'),
            browserPath: path.join(directory, 'browsers', 'chromium.exe'),
        }),
    };
}

test('init and snippets generate files safely and require --force to replace them', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-cli-'));
    const output: string[] = [];
    const errors: string[] = [];
    const streams = {out: (message: string) => output.push(message), error: (message: string) => errors.push(message)};
    try {
        const runtime = healthyRuntime(directory);

        assert.equal(runCli(['init'], streams, runtime), 0);
        const config = path.join(directory, 'playwright-ai-reporter.config.ts');
        const workflow = path.join(directory, '.github', 'workflows', 'playwright-ai-report.yml');
        assert.match(fs.readFileSync(config, 'utf8'), /satisfies ReporterConfig/);
        assert.match(fs.readFileSync(workflow, 'utf8'), /test-health-report\.html/);

        fs.writeFileSync(config, 'keep this');
        assert.equal(runCli(['init'], streams, runtime), 1);
        assert.equal(fs.readFileSync(config, 'utf8'), 'keep this');
        assert.match(errors.join('\n'), /Refusing to overwrite/);

        assert.equal(runCli(['init', '--force'], streams, runtime), 0);
        assert.match(fs.readFileSync(config, 'utf8'), /satisfies ReporterConfig/);
        assert.equal(runCli(['snippets'], streams, runtime), 0);
        const snippets = JSON.parse(
            fs.readFileSync(path.join(directory, '.vscode', 'playwright-ai-reporter.code-snippets'), 'utf8'),
        ) as Record<string, unknown>;
        assert.ok(snippets['Configure Playwright AI reporter']);
        assert.ok(snippets['Record API requests']);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('doctor reports missing selected-provider variables without printing secret values', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-cli-'));
    const output: string[] = [];
    const errors: string[] = [];
    try {
        let runtime = healthyRuntime(directory, {
            AI_PROVIDER: 'openai',
            OPENAI_API_KEY: 'doctor-secret-123456789',
        });
        assert.equal(
            runCli(
                ['doctor'],
                {out: (message) => output.push(message), error: (message) => errors.push(message)},
                runtime,
            ),
            0,
        );
        assert.match(output.join('\n'), /PASS AI_PROVIDER=openai/);
        assert.doesNotMatch(output.join('\n'), /doctor-secret/);

        output.length = 0;
        runtime = healthyRuntime(directory, {AI_PROVIDER: 'openai'});
        assert.equal(
            runCli(
                ['doctor'],
                {out: (message) => output.push(message), error: (message) => errors.push(message)},
                runtime,
            ),
            1,
        );
        assert.match(output.join('\n'), /FAIL AI_PROVIDER=openai: missing OPENAI_API_KEY/);
        assert.deepEqual(errors, []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('merge command writes a standalone report', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-cli-'));
    const output: string[] = [];
    const errors: string[] = [];
    try {
        const shards = ['one', 'two'].map((name, index) => {
            const shard = path.join(directory, name);
            fs.mkdirSync(shard);
            const testCase = {
                testId: `id-${index}`,
                testTitle: `test ${index}`,
                suiteTitle: 'suite',
                outcome: 'expected',
                attempts: [{retry: 0, status: 'passed', durationMs: 100, workerIndex: 0}],
            };
            const summary = {
                schemaVersion: 1,
                failures: [],
                testCount: 1,
                passedCount: 1,
                skippedCount: 0,
                failedCount: 0,
                totalTimeDisplay: '0.1s',
                averageTime: 0.1,
                slowestTest: 0.1,
                slowestTests: [],
                allTestCases: [testCase],
                timestamp: `2026-10-16T10:0${index}:00.000Z`,
                runEnvironment: 'Local',
            };
            fs.writeFileSync(path.join(shard, 'testSummary.json'), JSON.stringify(summary));
            fs.writeFileSync(path.join(shard, 'testFailures.json'), '[]');
            return shard;
        });
        const merged = path.join(directory, 'merged');

        const code = runCli(['merge', ...shards, '--output', merged], {
            out: (message) => output.push(message),
            error: (message) => errors.push(message),
        });

        assert.equal(code, 0);
        assert.deepEqual(errors, []);
        assert.match(output.join('\n'), /Merged 2 shards: 2 tests, 0 failures/);
        assert.equal(fs.existsSync(path.join(merged, 'test-health-report.html')), true);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});
