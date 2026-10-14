import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, test} from 'node:test';
import {IAIProvider} from '../providers/interfaces/IAIProvider';
import {ProviderRegistry} from '../providers/ProviderRegistry';
import {TestFailure} from '../types';
import {GenAIUtils} from './genaiUtils';

const originalSource = [
    "import {test, expect} from '@playwright/test';",
    "test('form', async ({page}) => {",
    "    await page.getByTestId('old').fill('Ada');",
    "    await expect(page.getByLabel('Name')).toHaveValue('Ada');",
    '});',
].join('\n');

const registry = ProviderRegistry as unknown as {getAIProvider: () => Promise<IAIProvider>};
const originalGetAIProvider = registry.getAIProvider;
const originalCwd = process.cwd();

let directory: string;
let failure: TestFailure;

function provider(respond: () => Promise<string>): IAIProvider {
    return {
        getName: () => 'fake',
        initialize: async () => undefined,
        generateCompletion: async () => ({content: await respond()}),
        generateText: async () => respond(),
        testConnection: async () => true,
    };
}

function useProvider(respond: () => Promise<string>): void {
    registry.getAIProvider = async () => provider(respond);
}

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'genai-'));
    process.chdir(directory);
    const testFile = path.join(directory, 'form.spec.ts');
    fs.writeFileSync(testFile, originalSource);
    failure = {
        testId: 'id-1',
        testTitle: 'form',
        suiteTitle: 'form.spec.ts',
        owningTeam: 'web',
        errorMessage: "waiting for getByTestId('old')",
        errorStack: 'at form.spec.ts:3',
        duration: 1,
        isTimeout: true,
        errorCategory: 'Timeout/DelayedElement',
        testFile,
    };
});

afterEach(() => {
    registry.getAIProvider = originalGetAIProvider;
    process.chdir(originalCwd);
    fs.rmSync(directory, {recursive: true, force: true});
});

test('prompt asks for a root cause, the corrected file, and forbids weakening the test', () => {
    const prompt = GenAIUtils.buildFixPrompt(failure, originalSource);

    assert.match(prompt, /Product, Test, Infrastructure, Environment\/Data, Flaky\/Timing or Unknown/);
    assert.match(prompt, /## Corrected file/);
    assert.match(prompt, /waitForTimeout/);
    assert.match(prompt, /waiting for getByTestId\('old'\)/);
});

test('a failing provider yields no fix and writes no fix file', async () => {
    useProvider(async () => {
        throw new Error('quota exceeded');
    });
    const errors = console.error;
    console.error = () => undefined;

    try {
        const result = await GenAIUtils.generateFixSuggestion(failure, new Map());

        assert.equal(result, null);
        assert.equal(fs.existsSync(path.join(directory, 'test-results', 'fixes')), true);
        assert.deepEqual(fs.readdirSync(path.join(directory, 'test-results', 'fixes')), []);
    } finally {
        console.error = errors;
    }
});

test('a valid corrected file is returned as an accepted replacement', async () => {
    const corrected = originalSource.replace("getByTestId('old')", "getByLabel('Name')");
    useProvider(
        async () => `Domain: Test. The test id was removed.\n\n## Corrected file\n\`\`\`ts\n${corrected}\n\`\`\``,
    );

    const result = await GenAIUtils.generateFixSuggestion(failure, new Map());

    assert.ok(result);
    assert.equal(result.analysis, 'Domain: Test. The test id was removed.');
    assert.equal(result.patchedSource, corrected);
    assert.equal(result.replacement?.ok, true);
    assert.match(fs.readFileSync(result.fixPath, 'utf8'), /Corrected file/);
});

test('a corrected file that weakens the test is returned but rejected', async () => {
    const weakened = "import {test} from '@playwright/test';\ntest('form', async () => {});";
    useProvider(async () => `Analysis.\n\n## Corrected file\n\`\`\`ts\n${weakened}\n\`\`\``);

    const result = await GenAIUtils.generateFixSuggestion(failure, new Map());

    assert.ok(result);
    assert.equal(result.replacement?.ok, false);
    assert.ok((result.replacement?.reasons.length ?? 0) > 0);
});

test('an analysis without a corrected file has no replacement', async () => {
    useProvider(async () => 'Domain: Environment/Data. Expired credential. Do not change the test.');

    const result = await GenAIUtils.generateFixSuggestion(failure, new Map());

    assert.ok(result);
    assert.equal(result.patchedSource, undefined);
    assert.equal(result.replacement, undefined);
    assert.match(result.analysis, /Expired credential/);
});
