import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BugInfo, BugStatus, IBugTrackerProvider} from '../providers/interfaces/IBugTrackerProvider';
import {closeFixedBugs, selectBugsToClose, TEST_FAILURE_LABEL} from './bugLifecycle';

const bug = (id: string, title: string): BugInfo => ({
    id,
    url: `https://x/issues/${id}`,
    status: BugStatus.Open,
    title,
});

class FakeTracker implements IBugTrackerProvider {
    closed: Array<{id: string; comment?: string}> = [];
    query: unknown;

    constructor(
        private readonly open: BugInfo[],
        private readonly failingIds: string[] = [],
    ) {}

    async createBug(): Promise<BugInfo | null> {
        throw new Error('not used');
    }
    async updateBug(): Promise<BugInfo | null> {
        throw new Error('not used');
    }
    async closeBug(id: string, comment?: string): Promise<BugInfo | null> {
        if (this.failingIds.includes(id)) {
            return null;
        }
        this.closed.push({id, comment});
        return {...bug(id, ''), status: BugStatus.Closed};
    }
    async findBugs(query: {title?: string; labels?: string[]; status?: BugStatus}): Promise<BugInfo[]> {
        this.query = query;
        return this.open;
    }
    async addComment(): Promise<boolean> {
        return true;
    }
}

test('matches bugs to verified tests by exact title', () => {
    const selected = selectBugsToClose(
        [bug('1', '[Test Failure] login works'), bug('2', '[Test Failure] login works fine'), bug('3', 'Unrelated')],
        ['login works'],
    );

    assert.deepEqual(
        selected.map((item) => item.bug.id),
        ['1'],
    );
});

test('closes only bugs for verified tests, with a verification comment', async () => {
    const tracker = new FakeTracker([bug('1', '[Test Failure] a'), bug('2', '[Test Failure] b')]);

    const closed = await closeFixedBugs(tracker, ['a'], {
        isPipeline: true,
        buildLink: 'https://x/runs/9',
    });

    assert.deepEqual(
        closed.map((item) => item.bug.id),
        ['1'],
    );
    assert.deepEqual(
        tracker.closed.map((item) => item.id),
        ['1'],
    );
    assert.match(tracker.closed[0]?.comment ?? '', /runs\/9/);
    assert.deepEqual(tracker.query, {labels: [TEST_FAILURE_LABEL], status: BugStatus.Open});
});

test('does not query the tracker when nothing is verified', async () => {
    const tracker = new FakeTracker([bug('1', '[Test Failure] a')]);

    assert.deepEqual(await closeFixedBugs(tracker, []), []);
    assert.equal(tracker.query, undefined);
});

test('a bug that cannot be closed does not stop the others', async () => {
    const tracker = new FakeTracker([bug('1', '[Test Failure] a'), bug('2', '[Test Failure] b')], ['1']);

    const closed = await closeFixedBugs(tracker, ['a', 'b']);

    assert.deepEqual(
        closed.map((item) => item.bug.id),
        ['2'],
    );
});
