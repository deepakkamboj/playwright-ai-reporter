/**
 * Interface for bug tracking providers (Azure DevOps, GitHub, Jira, etc.)
 */

import {TestFailure} from '../../types';

export enum BugPriority {
    Critical = 'Critical',
    High = 'High',
    Medium = 'Medium',
    Low = 'Low',
}

export enum BugStatus {
    Open = 'Open',
    InProgress = 'InProgress',
    Resolved = 'Resolved',
    Closed = 'Closed',
}

export interface BugDetails {
    title: string;
    description: string;
    priority: BugPriority;
    labels?: string[];
    assignee?: string;
    testFailure: TestFailure;
    additionalFields?: Record<string, any>;
}

export interface BugInfo {
    id: string;
    url: string;
    status: BugStatus;
    title: string;
}

export interface IBugTrackerProvider {
    /**
     * Create a bug/issue for a test failure
     * @param bugDetails - Details of the bug to create
     * @returns Information about the created bug
     */
    createBug(bugDetails: BugDetails): Promise<BugInfo | null>;

    /**
     * Update an existing bug with new information
     * @param bugId - Identifier of the bug to update
     * @param updates - Fields to update
     * @returns Updated bug information
     */
    updateBug(bugId: string, updates: Partial<BugDetails>): Promise<BugInfo | null>;

    /**
     * Close a bug (test is now passing)
     * @param bugId - Identifier of the bug to close
     * @param comment - Optional closing comment
     * @returns Updated bug information
     */
    closeBug(bugId: string, comment?: string): Promise<BugInfo | null>;

    /**
     * Search for existing bugs matching criteria
     * @param query - Search criteria
     * @returns List of matching bugs
     */
    findBugs(query: {title?: string; labels?: string[]; status?: BugStatus}): Promise<BugInfo[]>;

    /**
     * Add a comment to a bug
     * @param bugId - Identifier of the bug
     * @param comment - Comment to add
     * @returns Success indicator
     */
    addComment(bugId: string, comment: string): Promise<boolean>;
}
