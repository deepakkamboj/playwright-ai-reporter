import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateReplacement} from './fixValidator';

const original = [
    "import {test, expect} from '@playwright/test';",
    "test('form', async ({page}) => {",
    "    await page.getByTestId('old').fill('Ada');",
    "    await expect(page.getByLabel('Name')).toHaveValue('Ada');",
    '});',
].join('\n');

const fixed = original.replace("getByTestId('old')", "getByLabel('Name')");

test('accepts a small change that keeps the assertions', () => {
    assert.deepEqual(validateReplacement(original, fixed), {ok: true, reasons: []});
});

test('rejects a missing replacement', () => {
    assert.equal(validateReplacement(original, undefined).ok, false);
    assert.equal(validateReplacement(original, '   ').ok, false);
});

test('rejects an unchanged file', () => {
    const result = validateReplacement(original, original.replace(/\n/g, '\r\n'));

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /identical/);
});

test('rejects markdown prose or fences written into the file', () => {
    const result = validateReplacement(original, `${fixed}\n\`\`\`\nnotes\n\`\`\``);

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /markdown/);
});

test('rejects a rewrite larger than the allowed ratio', () => {
    const result = validateReplacement(original, `${fixed}\n${'// padding\n'.repeat(60)}`);

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /larger than/);
});

test('rejects fewer assertions', () => {
    const weakened = fixed.replace(/.*await expect.*\n/, '');

    const result = validateReplacement(original, weakened);

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /fewer assertions/);
});

test('rejects a newly skipped test', () => {
    const result = validateReplacement(original, fixed.replace("test('form'", "test.skip('form'"));

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /skips/);
});

test('rejects a new fixed wait', () => {
    const result = validateReplacement(
        original,
        fixed.replace('    await page.getByLabel', '    await page.waitForTimeout(2000);\n    await page.getByLabel'),
    );

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /waitForTimeout/);
});

test('rejects a file that no longer defines tests', () => {
    const result = validateReplacement(original, "export const x = 'getByLabel expect( expect(';");

    assert.equal(result.ok, false);
    assert.match(result.reasons.join(' '), /no longer defines any tests/);
});

test('keeps existing skips and waits that were already in the file', () => {
    const withLegacy = `${original}\ntest.skip('legacy', async () => {});\n// waitForTimeout( is documented`;
    const result = validateReplacement(withLegacy, withLegacy.replace("getByTestId('old')", "getByLabel('Name')"));

    assert.equal(result.ok, true);
});
