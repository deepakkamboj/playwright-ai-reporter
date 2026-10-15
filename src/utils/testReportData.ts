/**
 * Turns what happened to one test in one run into the data the report shows:
 * a short summary per attempt, links to the artifacts, and the flakiness verdict.
 */

import * as fs from 'fs';
import * as path from 'path';
import {stripAnsi} from './ansi';
import {analyzeFlakiness, classifyError, HistoryTestEntry, RunStatus} from './flakyAnalysis';
import {
    ApiCall,
    ArtifactLink,
    AttachmentRef,
    AttemptInfo,
    AttemptSummary,
    FlakinessReport,
    TestArtifacts,
    TestMetadata,
    TestRecord,
} from '../types';

/** Maps Playwright's test outcome to the status the history remembers. */
export function statusOf(outcome: string | undefined): RunStatus {
    switch (outcome) {
        case 'expected':
            return 'passed';
        case 'flaky':
            return 'flaky';
        case 'skipped':
            return 'skipped';
        default:
            return 'failed';
    }
}

const firstLine = (text: string): string => text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';

export function summarizeAttempts(attempts: AttemptInfo[]): AttemptSummary[] {
    return attempts.map((attempt, index) => {
        const message = stripAnsi(attempt.errors[0]?.message ?? '');

        return {
            retry: attempt.retry ?? index,
            status: attempt.status,
            durationMs: Math.round(attempt.duration * 1000),
            ...(attempt.startTime ? {startTime: attempt.startTime} : {}),
            ...(attempt.workerIndex !== undefined ? {workerIndex: attempt.workerIndex} : {}),
            ...(message ? {error: firstLine(message), kind: classifyError(message)} : {}),
        };
    });
}

/**
 * A test declares metadata by attaching JSON named "meta" (or "<anything>:meta"), or with a content
 * type ending in "-meta", for example application/x-workshop-meta.
 */
export function isMetaAttachment(attachment: {name: string; contentType: string}): boolean {
    return /(^|:)meta$/i.test(attachment.name) || /-meta$/i.test(attachment.contentType);
}

/** The metadata a test declared in its latest attempt that declared any. Damaged JSON is ignored. */
export function readMeta(attempts: AttemptInfo[]): TestMetadata | undefined {
    for (const attempt of [...attempts].reverse()) {
        for (const attachment of attempt.attachments ?? []) {
            if (!attachment.body || !isMetaAttachment(attachment)) continue;
            try {
                const parsed: unknown = JSON.parse(attachment.body);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed as TestMetadata;
                }
            } catch {
                // Not JSON: not metadata
            }
        }
    }
    return undefined;
}

/** The attachment name recordApi() uses for the API calls of a test. */
export const API_ATTACHMENT_NAME = 'api-calls';

/** Attachments whose content the reporter keeps: metadata and recorded API calls. */
export function isRecordedAttachment(attachment: {name: string; contentType: string}): boolean {
    return isMetaAttachment(attachment) || attachment.name === API_ATTACHMENT_NAME;
}

/** The API calls recorded during one attempt. Damaged JSON is ignored. */
export function readApiCalls(attempt: AttemptInfo | undefined): ApiCall[] | undefined {
    const attachment = attempt?.attachments?.find((a) => a.name === API_ATTACHMENT_NAME && a.body);
    if (!attachment?.body) return undefined;
    try {
        const parsed: unknown = JSON.parse(attachment.body);
        return Array.isArray(parsed) ? (parsed as ApiCall[]) : undefined;
    } catch {
        return undefined;
    }
}

const ARTIFACT_NAMES: Record<string, keyof TestArtifacts> = {
    screenshot: 'screenshot',
    video: 'video',
    trace: 'trace',
    'error-context': 'errorContext',
};

const toLink = (file: string, reportDir: string, cwd: string): ArtifactLink => ({
    href: path.relative(reportDir, file).replace(/\\/g, '/'),
    path: path.relative(cwd, file).replace(/\\/g, '/'),
});

/** Links to the files of one attempt that exist on disk. */
export function collectArtifacts(
    attachments: AttachmentRef[] | undefined,
    reportDir: string,
    cwd: string = process.cwd(),
): TestArtifacts {
    const artifacts: TestArtifacts = {};

    for (const attachment of attachments ?? []) {
        const key = ARTIFACT_NAMES[attachment.name];
        if (key && attachment.path && !artifacts[key] && fs.existsSync(attachment.path)) {
            artifacts[key] = toLink(attachment.path, reportDir, cwd);
        }
    }

    return artifacts;
}

export interface TestReportData {
    retryCount: number;
    attempts: AttemptSummary[];
    artifacts: TestArtifacts;
    flakiness: FlakinessReport;
    meta?: TestMetadata;
    apiCalls?: ApiCall[];
}

export function describeTest(record: TestRecord, history: HistoryTestEntry[], reportDir: string): TestReportData {
    const summaries = summarizeAttempts(record.attempts);
    const failedAttempts = record.attempts.filter(
        (attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped',
    );
    // The last failed attempt is the one to investigate: it is the freshest evidence of the failure.
    const evidenceAttempt = failedAttempts[failedAttempts.length - 1];
    const meta = readMeta(record.attempts);
    // Calls are kept for tests that did not pass cleanly: they are evidence, and they make the report large
    const apiCalls = evidenceAttempt ? readApiCalls(evidenceAttempt) : undefined;

    return {
        retryCount: Math.max(record.attempts.length - 1, 0),
        attempts: summaries,
        artifacts: collectArtifacts(evidenceAttempt?.attachments, reportDir),
        ...(meta ? {meta} : {}),
        ...(apiCalls ? {apiCalls} : {}),
        flakiness: analyzeFlakiness({
            attempts: summaries,
            finalStatus: statusOf(record.test.outcome),
            history,
        }),
    };
}
