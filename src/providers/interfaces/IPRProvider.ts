/**
 * Interface for Pull Request providers (GitHub, Azure DevOps, etc.)
 */

import {TestFailure} from '../../types';

export interface PROptions {
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description: string;
    reviewers?: string[];
    labels?: string[];
    autoMerge?: boolean;
    draft?: boolean;
}

export interface PRInfo {
    id: string;
    number: number;
    url: string;
    status: 'open' | 'merged' | 'closed';
    sourceBranch: string;
    targetBranch: string;
}

export interface FileChange {
    path: string;
    content: string;
    action: 'add' | 'modify' | 'delete';
}

export interface IPRProvider {
    /**
     * Create a branch for auto-fix changes
     * @param branchName - Name of the branch to create
     * @param baseBranch - Base branch to branch from
     * @returns Success indicator
     */
    createBranch(branchName: string, baseBranch: string): Promise<boolean>;

    /**
     * Commit file changes to a branch
     * @param branchName - Branch to commit to
     * @param changes - File changes to commit
     * @param commitMessage - Commit message
     * @returns Commit hash
     */
    commitChanges(branchName: string, changes: FileChange[], commitMessage: string): Promise<string | null>;

    /**
     * Create a pull request with auto-fix suggestions
     * @param options - PR creation options
     * @returns Information about the created PR
     */
    createPullRequest(options: PROptions): Promise<PRInfo | null>;

    /**
     * Update an existing pull request
     * @param prId - Pull request identifier
     * @param updates - Fields to update
     * @returns Updated PR information
     */
    updatePullRequest(prId: string, updates: Partial<PROptions>): Promise<PRInfo | null>;

    /**
     * Add a comment to a pull request
     * @param prId - Pull request identifier
     * @param comment - Comment to add
     * @returns Success indicator
     */
    addComment(prId: string, comment: string): Promise<boolean>;

    /**
     * Close a pull request
     * @param prId - Pull request identifier
     * @param comment - Optional closing comment
     * @returns Success indicator
     */
    closePullRequest(prId: string, comment?: string): Promise<boolean>;

    /**
     * Create auto-fix PR for test failures
     * @param failures - List of test failures with AI-generated fixes
     * @param baseBranch - Base branch for the PR
     * @returns Information about the created PR
     */
    createAutoFixPR(
        failures: Array<{failure: TestFailure; fixContent: string; filePath: string}>,
        baseBranch: string,
    ): Promise<PRInfo | null>;
}
