import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, test} from 'node:test';
import {clearCommentMetadataCache, commentMetadataAt, parseCommentMetadata} from './commentMetadata';

const directories: string[] = [];

afterEach(() => {
    clearCommentMetadataCache();
    for (const directory of directories.splice(0)) {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('parses custom tags, repeated values, and ignores standard JSDoc tags', () => {
    assert.deepEqual(
        parseCommentMetadata(`
        /**
         * @priority P1
         * @owner checkout-qa
         * @story SHOP-10
         * @story SHOP-11
         * @param page browser page
         * @returns nothing
         */
        `),
        {
            priority: 'P1',
            owner: 'checkout-qa',
            story: ['SHOP-10', 'SHOP-11'],
        },
    );
});

test('reads only the adjacent JSDoc block above the test declaration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-meta-'));
    directories.push(directory);
    const file = path.join(directory, 'example.spec.ts');
    fs.writeFileSync(
        file,
        [
            '/** @priority P0 */',
            'const helper = true;',
            '/**',
            ' * @priority P2',
            ' * @severity major',
            ' */',
            '',
            "test('works', async () => {});",
        ].join('\n'),
    );

    assert.deepEqual(commentMetadataAt({file, line: 8}), {priority: 'P2', severity: 'major'});
    assert.equal(commentMetadataAt({file, line: 3}), undefined);
});
