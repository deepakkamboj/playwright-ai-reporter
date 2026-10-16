#!/usr/bin/env node

import {createRequire} from 'module';
import * as path from 'path';
import {mergeShardReports} from './utils/shardMerge';
import {DoctorRuntime, initializeProject, installSnippets, runDoctor} from './utils/onboarding';

const HELP = `playwright-ai-reporter

Usage:
  playwright-ai-reporter merge <shard-dir> <shard-dir> [...] --output <directory>
  playwright-ai-reporter init [--dir <directory>] [--force]
  playwright-ai-reporter doctor [--output <directory>]
  playwright-ai-reporter snippets [--dir <directory>] [--force]

The merge command validates each shard's testSummary.json and testFailures.json, copies referenced
artifacts, renumbers worker lanes, and writes one deterministic standalone report.

init creates a typed reporter configuration and a GitHub Actions workflow. snippets installs VS Code
snippets. Existing files are never replaced unless --force is supplied. doctor validates the local
runtime, report assets, Playwright browser, output path, and selected provider environment variables
without installing packages, authenticating, or printing secret values.
`;

export interface CliStreams {
    out: (message: string) => void;
    error: (message: string) => void;
}

export type CliRuntime = DoctorRuntime;

function defaultRuntime(): CliRuntime {
    const cwd = process.cwd();
    const projectRequire = createRequire(path.join(cwd, 'package.json'));
    return {
        cwd,
        env: process.env,
        nodeVersion: process.version,
        packageRoot: path.resolve(__dirname, '..'),
        playwright: () => {
            const packagePath = projectRequire.resolve('@playwright/test/package.json');
            const playwright = projectRequire('@playwright/test') as {
                chromium: {executablePath: () => string};
            };
            return {packagePath, browserPath: playwright.chromium.executablePath()};
        },
    };
}

function parseMergeArgs(args: string[]): {inputs: string[]; output: string} {
    const inputs: string[] = [];
    let output = '';

    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--output' || argument === '-o') {
            if (output) throw new Error('The merge command accepts --output only once');
            const value = args[++index];
            if (!value) throw new Error(`${argument} requires a directory`);
            output = value;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`);
        } else {
            inputs.push(argument);
        }
    }

    if (!output) throw new Error('The merge command requires --output <directory>');
    if (inputs.length < 2) throw new Error('The merge command requires at least two shard directories');
    return {inputs, output};
}

function parseGenerationArgs(args: string[], cwd: string): {directory: string; force: boolean} {
    let directory = cwd;
    let force = false;
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--dir') {
            const value = args[++index];
            if (!value) throw new Error('--dir requires a directory');
            directory = path.resolve(cwd, value);
        } else if (argument === '--force') {
            if (force) throw new Error('The --force option can be supplied only once');
            force = true;
        } else {
            throw new Error(`Unknown option: ${argument}`);
        }
    }
    return {directory, force};
}

function parseDoctorArgs(args: string[]): string {
    let output = 'test-results/ai-report';
    let supplied = false;
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument !== '--output' && argument !== '-o') throw new Error(`Unknown option: ${argument}`);
        if (supplied) throw new Error('The doctor command accepts --output only once');
        const value = args[++index];
        if (!value) throw new Error(`${argument} requires a directory`);
        output = value;
        supplied = true;
    }
    return output;
}

export function runCli(
    args: string[],
    streams: CliStreams = {out: console.log, error: console.error},
    runtime: CliRuntime = defaultRuntime(),
): number {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        streams.out(HELP);
        return 0;
    }
    const command = args[0];
    if (!['merge', 'init', 'doctor', 'snippets'].includes(command)) {
        streams.error(`Unknown command: ${args[0]}\n\n${HELP}`);
        return 1;
    }

    try {
        if (command === 'merge') {
            const {inputs, output} = parseMergeArgs(args.slice(1));
            const result = mergeShardReports(inputs, output);
            streams.out(
                `Merged ${inputs.length} shards: ${result.testCount} tests, ${result.failureCount} failures\n` +
                    `Standalone report: ${path.resolve(result.reportPath)}`,
            );
        } else if (command === 'doctor') {
            const checks = runDoctor(parseDoctorArgs(args.slice(1)), runtime);
            checks.forEach((check) => streams.out(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`));
            if (checks.some((check) => !check.ok)) return 1;
        } else {
            const {directory, force} = parseGenerationArgs(args.slice(1), runtime.cwd);
            const files = command === 'init' ? initializeProject(directory, force) : installSnippets(directory, force);
            files.forEach((file) => streams.out(`${file.overwritten ? 'Replaced' : 'Created'} ${file.path}`));
        }
        return 0;
    } catch (error) {
        streams.error(
            `${command[0].toUpperCase()}${command.slice(1)} failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return 1;
    }
}

if (require.main === module) {
    process.exitCode = runCli(process.argv.slice(2));
}
