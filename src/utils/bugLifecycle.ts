/**
 * Closes test-failure bugs once their test is verified green.
 */

import {BugInfo, BugStatus, IBugTrackerProvider} from '../providers/interfaces/IBugTrackerProvider';
import {BuildInfo} from '../types';
import {BUG_TITLE_PREFIX, buildVerificationComment} from './bugReport';

/** Label added to every bug the reporter creates; used to find them again. */
export const TEST_FAILURE_LABEL = 'test-failure';

export interface ClosedBug {
    bug: BugInfo;
    testTitle: string;
}

/**
 * Matches open bugs to verified tests by exact title. Bug trackers search titles by substring, so
 * an exact comparison is required to avoid closing another test's bug.
 */
export function selectBugsToClose(openBugs: BugInfo[], verifiedTestTitles: string[]): ClosedBug[] {
    const verified = new Set(verifiedTestTitles);

    return openBugs
        .filter((bug) => bug.title.startsWith(BUG_TITLE_PREFIX))
        .map((bug) => ({bug, testTitle: bug.title.slice(BUG_TITLE_PREFIX.length)}))
        .filter(({testTitle}) => verified.has(testTitle));
}

/**
 * Closes the open bug for every verified test and returns what was closed.
 * A failure to close one bug does not stop the others.
 */
export async function closeFixedBugs(
    tracker: IBugTrackerProvider,
    verifiedTestTitles: string[],
    buildInfo?: BuildInfo,
): Promise<ClosedBug[]> {
    if (verifiedTestTitles.length === 0) {
        return [];
    }

    const openBugs = await tracker.findBugs({labels: [TEST_FAILURE_LABEL], status: BugStatus.Open});
    const closed: ClosedBug[] = [];

    for (const candidate of selectBugsToClose(openBugs, verifiedTestTitles)) {
        const result = await tracker.closeBug(
            candidate.bug.id,
            buildVerificationComment(candidate.testTitle, buildInfo),
        );
        if (result) {
            closed.push(candidate);
        }
    }

    return closed;
}
