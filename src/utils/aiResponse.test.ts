import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseFixResponse} from './aiResponse';

test('returns the whole response as analysis when there is no Corrected file heading', () => {
    const response = 'The locator is stale.\n\n```ts\nawait page.getByLabel("Name").fill("a");\n```';

    const parsed = parseFixResponse(response);

    assert.equal(parsed.patchedSource, undefined);
    assert.match(parsed.analysis, /locator is stale/);
});

test('extracts the complete file from the Corrected file section', () => {
    const response = [
        '## Root cause',
        'The test id was removed.',
        '',
        '## Corrected file',
        '```ts',
        "import {test} from '@playwright/test';",
        "test('a', async () => {});",
        '```',
    ].join('\n');

    const parsed = parseFixResponse(response);

    assert.equal(parsed.analysis, '## Root cause\nThe test id was removed.');
    assert.equal(parsed.patchedSource, "import {test} from '@playwright/test';\ntest('a', async () => {});");
});

test('does not treat a snippet before the heading as the corrected file', () => {
    const response = 'Try this:\n```ts\nawait x();\n```\n\n## Corrected file\nNone needed.';

    const parsed = parseFixResponse(response);

    assert.equal(parsed.patchedSource, undefined);
    assert.match(parsed.analysis, /Try this/);
});

test('handles Windows line endings', () => {
    const response = '## Root cause\r\nx\r\n## Corrected file\r\n```ts\r\nconst a = 1;\r\n```';

    assert.equal(parseFixResponse(response).patchedSource, 'const a = 1;');
});
