/**
 * A short Markdown summary of a run, for places that render Markdown: the GitHub Actions job summary
 * and the Azure Pipelines build page. It says what failed and who owns it, and points to the report.
 */

import {TestCaseDetails, TestSummary} from '../types';

const firstLine = (text: string | undefined): string =>
    (text ?? '').split(/\r?\n/).find((line) => line.trim() !== '') ?? '';

const cell = (text: string): string => text.replace(/\|/g, '\\|').slice(0, 140);

const VERDICTS: Record<string, string> = {
    flaky: 'Flaky',
    'consistent-failure': 'Known failure',
    'new-failure': 'New failure',
};

export function buildSummaryMarkdown(summary: TestSummary, tests: TestCaseDetails[], reportFile?: string): string {
    const ran = summary.testCount - summary.skippedCount;
    const rate = ran > 0 ? Math.round((summary.passedCount / ran) * 100) : 0;
    const flaky = tests.filter((test) => test.outcome === 'flaky');
    const lines = [
        `## Test health: ${summary.passedCount} of ${ran} passed (${rate}%)`,
        '',
        `Failed **${summary.failedCount}** · flaky **${flaky.length}** · skipped **${summary.skippedCount}** · ${summary.totalTimeDisplay}`,
    ];

    const failing = tests.filter((test) => test.outcome === 'unexpected' || test.outcome === 'flaky');
    if (failing.length > 0) {
        lines.push('', '| Test | Priority | Owner | Verdict | Error |', '|---|---|---|---|---|');
        for (const test of failing) {
            const failure = summary.failures.find((f) => f.testId === test.testId);
            lines.push(
                `| ${cell(test.testTitle)} | ${cell(String(test.meta?.priority ?? '-'))} | ${cell(
                    test.owningTeam ?? '-',
                )} | ${VERDICTS[test.flakiness?.verdict ?? ''] ?? 'Failed'} | ${cell(firstLine(failure?.errorMessage))} |`,
            );
        }
    }

    if (reportFile) {
        lines.push('', `Open **${reportFile}** from the \`test-health-report\` artifact for traces, API calls and clusters.`);
    }

    return lines.join('\n') + '\n';
}
