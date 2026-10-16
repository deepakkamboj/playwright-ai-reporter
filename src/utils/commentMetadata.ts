import * as fs from 'fs';
import {TestMetadata} from '../types';
import {redactText} from './redaction';

const IGNORED_TAGS = new Set([
    'abstract',
    'access',
    'argument',
    'async',
    'augments',
    'author',
    'borrows',
    'callback',
    'class',
    'constructor',
    'copyright',
    'default',
    'deprecated',
    'description',
    'enum',
    'example',
    'exports',
    'extends',
    'fires',
    'function',
    'generator',
    'global',
    'hideconstructor',
    'ignore',
    'implements',
    'inheritdoc',
    'inner',
    'instance',
    'interface',
    'kind',
    'lends',
    'license',
    'listens',
    'member',
    'memberof',
    'mixes',
    'mixin',
    'module',
    'name',
    'namespace',
    'override',
    'package',
    'param',
    'private',
    'property',
    'protected',
    'public',
    'readonly',
    'requires',
    'returns',
    'see',
    'since',
    'static',
    'summary',
    'template',
    'this',
    'throws',
    'todo',
    'tutorial',
    'type',
    'typedef',
    'variation',
    'version',
    'virtual',
    'yields',
]);

const sourceCache = new Map<string, string | undefined>();

function sourceOf(file: string): string | undefined {
    if (sourceCache.has(file)) return sourceCache.get(file);
    try {
        const source = fs.readFileSync(file, 'utf8');
        sourceCache.set(file, source);
        return source;
    } catch {
        sourceCache.set(file, undefined);
        return undefined;
    }
}

function addValue(metadata: TestMetadata, key: string, value: string): void {
    const current = metadata[key];
    if (current === undefined) {
        metadata[key] = value;
    } else if (Array.isArray(current)) {
        current.push(value);
    } else {
        metadata[key] = [current, value];
    }
}

/** Parses custom `@key value` tags from one JSDoc block. */
export function parseCommentMetadata(comment: string): TestMetadata | undefined {
    const metadata: TestMetadata = {};
    for (const line of comment.split(/\r?\n/)) {
        const match = /^\s*(?:\/\*\*|\*)?\s*@([A-Za-z][\w-]*)\s+(.+?)\s*(?:\*\/)?\s*$/.exec(line);
        if (!match) continue;
        const key = match[1].toLowerCase();
        if (IGNORED_TAGS.has(key)) continue;
        addValue(metadata, key, redactText(match[2]));
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Reads metadata only from the JSDoc block directly above a test declaration.
 * Ordinary comments and JSDoc separated by code are deliberately ignored.
 */
export function commentMetadataAt(location: {file?: string; line?: number} | undefined): TestMetadata | undefined {
    if (!location?.file || !location.line || location.line < 1) return undefined;
    const source = sourceOf(location.file);
    if (source === undefined) return undefined;

    const preceding = source
        .split(/\r?\n/)
        .slice(0, location.line - 1)
        .join('\n')
        .trimEnd();
    if (!preceding.endsWith('*/')) return undefined;
    const opening = preceding.lastIndexOf('/**');
    if (opening < 0) return undefined;
    const comment = preceding.slice(opening);
    if (comment.slice(3, -2).includes('/**')) return undefined;
    return parseCommentMetadata(comment);
}

/** Test-only hook that also prevents stale source after a watch-mode rewrite. */
export function clearCommentMetadataCache(): void {
    sourceCache.clear();
}
