import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import * as path from 'node:path';
import {test} from 'node:test';
import ts from 'typescript';

test('TypeScript documentation examples match the public reporter API', () => {
    const root = path.resolve(__dirname, '..', '..');
    const pages = path.join(root, 'docs', 'pages');
    const files = new Map<string, string>();

    for (const name of readdirSync(pages)
        .filter((name) => name.endsWith('.mdx'))
        .sort()) {
        const markdown = readFileSync(path.join(pages, name), 'utf8');
        for (const match of markdown.matchAll(/```ts\r?\n([\s\S]*?)```/g)) {
            const code = match[1];
            const filename = code.match(/^\/\/\s+([^\r\n]+)/)?.[1];
            assert.ok(filename, `${name}: TypeScript examples need a filepath comment`);
            const virtualPath = path.resolve(root, 'src', '.docs-examples', name, filename);
            assert.ok(!files.has(virtualPath), `${name}: duplicate example path ${filename}`);
            files.set(virtualPath, code);
        }
    }
    assert.ok(files.size > 0, 'Expected TypeScript documentation examples');

    const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    assert.equal(configFile.error, undefined);
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
    assert.deepEqual(config.errors, []);
    const manifest: {name: string; exports: Record<string, {types: string}>} = JSON.parse(
        readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const publicPaths = Object.fromEntries(
        Object.entries(manifest.exports).map(([entry, contract]) => {
            assert.match(contract.types, /^\.\/dist\/.+\.d\.ts$/);
            const source = contract.types.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, '.ts');
            assert.ok(existsSync(path.join(root, source)), `Missing public entry source: ${source}`);
            return [entry === '.' ? manifest.name : manifest.name + entry.slice(1), [source]];
        }),
    );
    const options: ts.CompilerOptions = {
        ...config.options,
        noEmit: true,
        baseUrl: root,
        paths: publicPaths,
    };
    const host = ts.createCompilerHost(options);
    const original = {
        fileExists: host.fileExists,
        readFile: host.readFile,
        directoryExists: host.directoryExists,
        getSourceFile: host.getSourceFile,
    };
    const paths = [...files.keys()];
    host.fileExists = (filename) => files.has(path.resolve(filename)) || original.fileExists(filename);
    host.readFile = (filename) => files.get(path.resolve(filename)) ?? original.readFile(filename);
    host.directoryExists = (directory) =>
        paths.some((filename) => filename.startsWith(path.resolve(directory) + path.sep)) ||
        Boolean(original.directoryExists?.(directory));
    host.getSourceFile = (filename, language, onError, createNew) => {
        const code = files.get(path.resolve(filename));
        return code === undefined
            ? original.getSourceFile(filename, language, onError, createNew)
            : ts.createSourceFile(filename, code, language, true);
    };
    const program = ts.createProgram(paths, options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
        diagnostics.length,
        0,
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCanonicalFileName: (filename) => filename,
            getCurrentDirectory: () => root,
            getNewLine: () => '\n',
        }),
    );
});
