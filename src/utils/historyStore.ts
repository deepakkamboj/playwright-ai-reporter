/**
 * Remembers how each test ended in the last runs, so flaky tests can be recognised across runs.
 * The file is plain JSON. A missing or damaged file is treated as no history, never as an error:
 * history is an aid and must not break a test run.
 */

import * as fs from 'fs';
import * as path from 'path';
import {TrendPoint} from '../types';
import {HistoryTestEntry} from './flakyAnalysis';
import {redactJson} from './redaction';

export const MAX_HISTORY_RUNS = 30;

export interface HistoryRun {
    /** ISO timestamp of the run. */
    time: string;
    /** CI run id or build number, when known. */
    runId?: string;
    /** How each test ended, keyed by testKey(). */
    tests: Record<string, HistoryTestEntry>;
}

/** A stable identity for a test across runs: its file and title, not the run-specific id. */
export function testKey(file: string | undefined, title: string, cwd: string = process.cwd()): string {
    const relative = file && path.isAbsolute(file) ? path.relative(cwd, file) : (file ?? '');
    return `${relative.replace(/\\/g, '/')}::${title}`;
}

export function loadHistory(filePath: string): HistoryRun[] {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(parsed)
            ? (parsed as HistoryRun[]).filter((run) => run && typeof run.tests === 'object')
            : [];
    } catch {
        return [];
    }
}

export function saveHistory(filePath: string, runs: HistoryRun[]): void {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, redactJson(runs, 2));
}

/** Adds a run and keeps only the most recent ones. */
export function recordRun(runs: HistoryRun[], run: HistoryRun, max: number = MAX_HISTORY_RUNS): HistoryRun[] {
    return [...runs, run].slice(-max);
}

/** Counts of tests per outcome for each run, for the trend chart. */
export function trendOf(runs: HistoryRun[]): TrendPoint[] {
    return runs.map((run) => {
        const point: TrendPoint = {
            time: run.time,
            ...(run.runId ? {runId: run.runId} : {}),
            passed: 0,
            failed: 0,
            flaky: 0,
            skipped: 0,
        };
        for (const entry of Object.values(run.tests)) {
            point[entry.status] += 1;
        }
        return point;
    });
}

/** The earlier results of one test, oldest first. */
export function historyFor(runs: HistoryRun[], key: string): HistoryTestEntry[] {
    return runs.flatMap((run) => (run.tests[key] ? [run.tests[key]] : []));
}
