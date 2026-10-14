/**
 * Decides whether an AI-proposed replacement is safe to commit as the new content of a test file.
 *
 * The check is intentionally conservative. A rejected replacement is never committed; the analysis
 * is still reported. The rules mirror what a reviewer would reject on sight:
 * markdown or an empty answer, an unchanged file, a large rewrite, fewer assertions,
 * newly skipped tests, and newly added fixed waits.
 */

export interface ReplacementCheck {
    ok: boolean;
    reasons: string[];
}

/** Largest allowed size change relative to the original file. */
export const DEFAULT_MAX_CHANGE_RATIO = 0.5;

const normalize = (source: string): string => source.replace(/\r\n/g, '\n').trim();

const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length;

const ASSERTIONS = /\bexpect\s*(?:\.soft|\.poll)?\s*\(/g;
const SKIPS = /\b(?:test|it|describe)\s*\.\s*(?:skip|fixme)\b|\.\s*skip\s*\(/g;
const FIXED_WAITS = /\bwaitForTimeout\s*\(/g;
const TEST_DEFINITIONS = /\b(?:test|it|describe)\s*(?:\.\s*\w+\s*)*\(/;

export function validateReplacement(
    original: string,
    candidate: string | undefined,
    maxChangeRatio: number = DEFAULT_MAX_CHANGE_RATIO,
): ReplacementCheck {
    const reasons: string[] = [];

    if (candidate === undefined || normalize(candidate) === '') {
        return {ok: false, reasons: ['No corrected file was returned.']};
    }

    const before = normalize(original);
    const after = normalize(candidate);

    if (after === before) {
        reasons.push('The corrected file is identical to the original.');
    }

    if (/^\s*```/m.test(candidate)) {
        reasons.push('The corrected file contains markdown code fences.');
    }

    if (before.length > 0 && Math.abs(after.length - before.length) / before.length > maxChangeRatio) {
        reasons.push(`The change is larger than ${Math.round(maxChangeRatio * 100)}% of the original file.`);
    }

    if (TEST_DEFINITIONS.test(before) && !TEST_DEFINITIONS.test(after)) {
        reasons.push('The corrected file no longer defines any tests.');
    }

    if (count(after, ASSERTIONS) < count(before, ASSERTIONS)) {
        reasons.push('The corrected file has fewer assertions than the original.');
    }

    if (count(after, SKIPS) > count(before, SKIPS)) {
        reasons.push('The corrected file skips a test that was not skipped before.');
    }

    if (count(after, FIXED_WAITS) > count(before, FIXED_WAITS)) {
        reasons.push('The corrected file adds a fixed wait (waitForTimeout).');
    }

    return {ok: reasons.length === 0, reasons};
}
