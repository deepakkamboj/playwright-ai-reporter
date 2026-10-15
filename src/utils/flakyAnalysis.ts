/**
 * Decides whether a test is flaky and why, from this run's attempts and the recorded history.
 * Pure functions: no I/O, so every rule can be unit tested.
 */

import {stripAnsi} from './ansi';
import {AttemptSummary, FlakinessReport, FlakinessVerdict} from '../types';

export type RunStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

/** What the history remembers about one test in one earlier run. */
export interface HistoryTestEntry {
    status: RunStatus;
    durationMs: number;
    /** Error kind of the failure, when it failed. */
    kind?: string;
}

export const ERROR_KINDS = [
    'Network',
    'Ambiguous locator',
    'Assertion timing',
    'Assertion',
    'Element not ready',
    'Unknown',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Classifies an error message by what it says happened, not by guessing a cause. */
export function classifyError(message: string | undefined): ErrorKind {
    const text = stripAnsi(message ?? '');

    if (!text.trim()) return 'Unknown';
    if (/net::ERR|ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|socket hang up|status[= ]5\d\d|\b50[0234]\b/i.test(text)) {
        return 'Network';
    }
    if (/strict mode violation/i.test(text)) return 'Ambiguous locator';
    if (/expect\(/.test(text) && /timeout:?\s*\d+\s*ms/i.test(text)) return 'Assertion timing';
    if (/expect\(|Expected:|Received:/.test(text)) return 'Assertion';
    if (/timeout \d+\s*ms exceeded|timed out|waiting for/i.test(text)) return 'Element not ready';

    return 'Unknown';
}

const RECOMMENDATIONS: Record<ErrorKind, string> = {
    Network:
        'A request failed or was slow. Check the service the page calls, and wait on that specific response instead of retrying blindly.',
    'Ambiguous locator':
        'The locator matches more than one element. Use a role or label locator that matches exactly one.',
    'Assertion timing':
        'The expected state arrived later than the assertion allowed. Find what was slow in the trace and wait on that condition. Do not add a fixed sleep or raise timeouts globally.',
    Assertion:
        'The value differed from what was expected. Check test data and tests that depend on the order they run in.',
    'Element not ready':
        'If it fails on every run the locator is probably stale: compare it with the page snapshot in error-context.md. If it fails only sometimes, wait on an observable state that proves readiness.',
    Unknown: 'Open the trace and compare a failing attempt with a passing one.',
};

export interface FlakinessInput {
    /** Every attempt of this test in this run, in order. */
    attempts: AttemptSummary[];
    /** How the test ended in this run. */
    finalStatus: RunStatus;
    /** Earlier runs of this test, oldest first. Skipped runs are ignored. */
    history: HistoryTestEntry[];
}

const didNotPass = (status: string): boolean => status === 'failed' || status === 'flaky';

interface Streak {
    start: number;
    length: number;
}

/** Maximal runs of consecutive "did not pass" results. */
function failureStreaks(sequence: boolean[]): Streak[] {
    const streaks: Streak[] = [];
    sequence.forEach((failed, index) => {
        if (!failed) return;
        const last = streaks[streaks.length - 1];
        if (last && last.start + last.length === index) {
            last.length++;
        } else {
            streaks.push({start: index, length: 1});
        }
    });
    return streaks;
}

function transitionsIn(sequence: boolean[]): number {
    return sequence.reduce(
        (count, value, index) => (index > 0 && value !== sequence[index - 1] ? count + 1 : count),
        0,
    );
}

function countBy(values: string[]): Array<[string, number]> {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function analyzeFlakiness({attempts, finalStatus, history}: FlakinessInput): FlakinessReport {
    const past = history.filter((entry) => entry.status !== 'skipped');
    const currentDidNotPass = didNotPass(finalStatus);
    const sequence = [...past.map((entry) => didNotPass(entry.status)), currentDidNotPass];
    const transitions = transitionsIn(sequence);
    const runs = sequence.length;
    const failedRuns = sequence.filter(Boolean).length;
    const failedAttempts = attempts.filter((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped');

    let verdict: FlakinessVerdict;
    // Flaky means the result alternates: it failed, recovered, and failed again; or a one-off failure
    // that recovered straight away. A failure streak that ends in a pass is a fix, not flakiness.
    const streaks = failureStreaks(sequence);
    const lastStreak = streaks[streaks.length - 1];
    const isolatedRecentFailure =
        !currentDidNotPass &&
        streaks.length === 1 &&
        lastStreak !== undefined &&
        lastStreak.length === 1 &&
        lastStreak.start > 0 &&
        lastStreak.start === runs - 2;

    if (finalStatus === 'flaky' || streaks.length >= 2 || isolatedRecentFailure) {
        verdict = 'flaky';
    } else if (finalStatus === 'failed') {
        const previous = past[past.length - 1];
        if (!previous) {
            verdict = attempts.length > 1 ? 'consistent-failure' : 'new-failure';
        } else {
            verdict = didNotPass(previous.status) ? 'consistent-failure' : 'new-failure';
        }
    } else {
        verdict = 'stable';
    }

    const kinds = [
        ...failedAttempts.map((attempt) => attempt.kind ?? classifyError(attempt.error)),
        ...past.filter((entry) => didNotPass(entry.status) && entry.kind).map((entry) => entry.kind as string),
    ];
    const patterns = countBy(kinds).map(([kind]) => kind);
    const primaryPattern = patterns[0] ?? 'Intermittent';

    const evidence: string[] = [];
    const firstFailure = attempts.find((attempt) => didNotPass(attempt.status) || attempt.status === 'timedOut');
    const passedAfter = attempts.find((attempt) => attempt.status === 'passed' && attempt.retry > 0);
    if (finalStatus === 'flaky' && firstFailure && passedAfter) {
        evidence.push(`Failed on attempt ${firstFailure.retry + 1}, then passed on retry ${passedAfter.retry}.`);
    }
    if (failedAttempts.length > 0 && attempts.length > 1) {
        evidence.push(`${failedAttempts.length} of ${attempts.length} attempts failed in this run.`);
    }
    if (past.length > 0) {
        evidence.push(`Did not pass first time in ${failedRuns} of ${runs} runs.`);
    }
    if (transitions >= 2) {
        evidence.push(`Result changed ${transitions} times across the last ${runs} runs.`);
    }
    if (currentDidNotPass && lastStreak && lastStreak.length >= 2 && lastStreak.start + lastStreak.length === runs) {
        evidence.push(`Has not passed first time for ${lastStreak.length} runs in a row.`);
    }
    const distinctErrors = new Set(failedAttempts.map((attempt) => attempt.error ?? ''));
    if (distinctErrors.size > 1) {
        evidence.push('Different errors on different attempts, which suggests a race rather than a fixed defect.');
    } else if (failedAttempts.length > 1) {
        evidence.push('The same error on every failed attempt, which suggests a fixed defect rather than a race.');
    }

    return {
        verdict,
        failureRate: Math.round((failedRuns / runs) * 100),
        runs,
        patterns,
        primaryPattern,
        evidence,
        recommendation: patterns[0] ? RECOMMENDATIONS[patterns[0] as ErrorKind] : RECOMMENDATIONS.Unknown,
    };
}
