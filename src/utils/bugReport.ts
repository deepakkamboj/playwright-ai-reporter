/**
 * Builds the text of a test-failure bug and the comment used when it is verified fixed.
 * Pure functions: no I/O, so the content can be unit tested.
 */

import {BuildInfo, TestFailure} from '../types';
import {redactText} from './redaction';

export const BUG_TITLE_PREFIX = '[Test Failure] ';

const MAX_ANALYSIS_CHARACTERS = 8000;
const MAX_STACK_CHARACTERS = 500;

export function bugTitle(testTitle: string): string {
    return redactText(`${BUG_TITLE_PREFIX}${testTitle}`);
}

export interface BugReportContext {
    /** AI root-cause analysis for this failure, when generateFix is enabled. */
    analysis?: string;
    buildInfo?: BuildInfo;
}

function truncate(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)}\n... (truncated)` : text;
}

function runSection(buildInfo?: BuildInfo): string {
    if (!buildInfo?.isPipeline) {
        return '';
    }

    const rows: string[] = [];
    if (buildInfo.buildLink) rows.push(`- **Run**: ${buildInfo.buildLink}`);
    if (buildInfo.buildBranch) rows.push(`- **Branch**: ${buildInfo.buildBranch}`);
    if (buildInfo.commitId) {
        rows.push(
            `- **Commit**: ${buildInfo.commitLink ? `[${buildInfo.commitId.slice(0, 7)}](${buildInfo.commitLink})` : buildInfo.commitId}`,
        );
    }
    if (buildInfo.artifactsLink) rows.push(`- **Artifacts** (trace, screenshot, video): ${buildInfo.artifactsLink}`);

    return rows.length > 0 ? `\n### Run\n${rows.join('\n')}\n` : '';
}

const metaValue = (value: unknown): string =>
    Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);

/** The facts a test declared about itself (priority, severity, feature, ...), one per line. */
function metaSection(meta: TestFailure['meta']): string {
    const entries = Object.entries(meta ?? {}).filter(([, value]) => value !== undefined && value !== null);
    return entries.length > 0
        ? `\n### Test metadata\n${entries.map(([key, value]) => `- **${key}**: ${metaValue(value)}`).join('\n')}\n`
        : '';
}

export function buildBugDescription(failure: TestFailure, context: BugReportContext = {}): string {
    const stack = failure.errorStack.substring(0, MAX_STACK_CHARACTERS);
    const analysis = context.analysis?.trim()
        ? `\n### Root cause analysis (AI)\n${truncate(context.analysis.trim(), MAX_ANALYSIS_CHARACTERS)}\n`
        : '';

    return redactText(`## Test Failure Report

**Test**: ${failure.testTitle}
**Suite**: ${failure.suiteTitle}
**File**: \`${failure.testFile || 'unknown'}\`
**Owner**: ${failure.owningTeam}
${metaSection(failure.meta)}
### Error
\`\`\`
${failure.errorMessage}
\`\`\`

### Error Category
${failure.errorCategory}
${analysis}${runSection(context.buildInfo)}
### Stack Trace
\`\`\`
${stack}${failure.errorStack.length > MAX_STACK_CHARACTERS ? '...' : ''}
\`\`\`

### Additional Information
- **Duration**: ${failure.duration.toFixed(2)}s
- **Timeout**: ${failure.isTimeout ? 'Yes' : 'No'}
- **Test ID**: ${failure.testId || 'N/A'}

---
_This bug was automatically created by playwright-ai-reporter_`);
}

export function buildVerificationComment(testTitle: string, buildInfo?: BuildInfo): string {
    const where = buildInfo?.buildLink ? ` in ${buildInfo.buildLink}` : '';
    const branch = buildInfo?.buildBranch ? ` on \`${buildInfo.buildBranch}\`` : '';
    const commit = buildInfo?.commitId ? ` at ${buildInfo.commitId.slice(0, 7)}` : '';

    return redactText(
        `Verified fixed: "${testTitle}" passed${where}${branch}${commit}. Closing this bug.\n\n_Closed automatically by playwright-ai-reporter_`,
    );
}
