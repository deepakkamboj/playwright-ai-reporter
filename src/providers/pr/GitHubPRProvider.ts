/**
 * GitHub Pull Request Provider
 */

import {IPRProvider, PROptions, PRInfo, FileChange} from '../interfaces/IPRProvider';
import {TestFailure} from '../../types';

export interface GitHubPRConfig {
    owner: string;
    repo: string;
    token: string;
}

export class GitHubPRProvider implements IPRProvider {
    private octokit: any;
    private config: GitHubPRConfig;
    private initialized: Promise<void>;

    constructor(config: GitHubPRConfig) {
        this.config = config;
        this.initialized = this.initialize();
    }

    private async initialize(): Promise<void> {
        const {Octokit} = await import('@octokit/rest');
        this.octokit = new Octokit({auth: this.config.token});
    }

    async createBranch(branchName: string, baseBranch: string): Promise<boolean> {
        await this.initialized;
        try {
            // Get the reference of the base branch
            const baseRef = await this.octokit.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${baseBranch}`,
            });

            // Create new branch from base
            await this.octokit.git.createRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `refs/heads/${branchName}`,
                sha: baseRef.data.object.sha,
            });

            console.log(`Created branch: ${branchName} from ${baseBranch}`);
            return true;
        } catch (error: any) {
            console.error('Error creating branch:', error.message);
            return false;
        }
    }

    async commitChanges(branchName: string, changes: FileChange[], commitMessage: string): Promise<string | null> {
        await this.initialized;
        try {
            // Get the current commit SHA of the branch
            const branchRef = await this.octokit.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${branchName}`,
            });

            const currentCommitSha = branchRef.data.object.sha;

            // Get the tree of the current commit
            const currentCommit = await this.octokit.git.getCommit({
                owner: this.config.owner,
                repo: this.config.repo,
                commit_sha: currentCommitSha,
            });

            const baseTreeSha = currentCommit.data.tree.sha;

            // Create blobs for each file change
            const tree: any[] = [];
            for (const change of changes) {
                if (change.action === 'delete') {
                    tree.push({
                        path: change.path,
                        mode: '100644',
                        type: 'blob',
                        sha: null,
                    });
                } else {
                    const blob = await this.octokit.git.createBlob({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        content: Buffer.from(change.content).toString('base64'),
                        encoding: 'base64',
                    });

                    tree.push({
                        path: change.path,
                        mode: '100644',
                        type: 'blob',
                        sha: blob.data.sha,
                    });
                }
            }

            // Create a new tree
            const newTree = await this.octokit.git.createTree({
                owner: this.config.owner,
                repo: this.config.repo,
                base_tree: baseTreeSha,
                tree,
            });

            // Create a new commit
            const newCommit = await this.octokit.git.createCommit({
                owner: this.config.owner,
                repo: this.config.repo,
                message: commitMessage,
                tree: newTree.data.sha,
                parents: [currentCommitSha],
            });

            // Update the branch reference
            await this.octokit.git.updateRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${branchName}`,
                sha: newCommit.data.sha,
            });

            console.log(`Committed changes to ${branchName}: ${newCommit.data.sha}`);
            return newCommit.data.sha;
        } catch (error: any) {
            console.error('Error committing changes:', error.message);
            return null;
        }
    }

    async createPullRequest(options: PROptions): Promise<PRInfo | null> {
        await this.initialized;
        try {
            const pr = await this.octokit.pulls.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title: options.title,
                body: options.description,
                head: options.sourceBranch,
                base: options.targetBranch,
                draft: options.draft,
            });

            // Add reviewers if specified
            if (options.reviewers && options.reviewers.length > 0) {
                await this.octokit.pulls.requestReviewers({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    pull_number: pr.data.number,
                    reviewers: options.reviewers,
                });
            }

            // Add labels if specified
            if (options.labels && options.labels.length > 0) {
                await this.octokit.issues.addLabels({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    issue_number: pr.data.number,
                    labels: options.labels,
                });
            }

            console.log(`Created pull request: #${pr.data.number}`);

            return {
                id: pr.data.id.toString(),
                number: pr.data.number,
                url: pr.data.html_url,
                status: 'open',
                sourceBranch: options.sourceBranch,
                targetBranch: options.targetBranch,
            };
        } catch (error: any) {
            console.error('Error creating pull request:', error.message);
            return null;
        }
    }

    async updatePullRequest(prId: string, updates: Partial<PROptions>): Promise<PRInfo | null> {
        await this.initialized;
        try {
            const prNumber = parseInt(prId);
            const updateData: any = {};

            if (updates.title) updateData.title = updates.title;
            if (updates.description) updateData.body = updates.description;

            const pr = await this.octokit.pulls.update({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: prNumber,
                ...updateData,
            });

            return {
                id: pr.data.id.toString(),
                number: pr.data.number,
                url: pr.data.html_url,
                status: pr.data.state === 'closed' ? (pr.data.merged ? 'merged' : 'closed') : 'open',
                sourceBranch: pr.data.head.ref,
                targetBranch: pr.data.base.ref,
            };
        } catch (error: any) {
            console.error('Error updating pull request:', error.message);
            return null;
        }
    }

    async addComment(prId: string, comment: string): Promise<boolean> {
        await this.initialized;
        try {
            const prNumber = parseInt(prId);
            await this.octokit.issues.createComment({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: prNumber,
                body: comment,
            });

            console.log(`Added comment to PR #${prNumber}`);
            return true;
        } catch (error: any) {
            console.error('Error adding comment to pull request:', error.message);
            return false;
        }
    }

    async closePullRequest(prId: string, comment?: string): Promise<boolean> {
        await this.initialized;
        try {
            const prNumber = parseInt(prId);

            if (comment) {
                await this.addComment(prId, comment);
            }

            await this.octokit.pulls.update({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: prNumber,
                state: 'closed',
            });

            console.log(`Closed PR #${prNumber}`);
            return true;
        } catch (error: any) {
            console.error('Error closing pull request:', error.message);
            return false;
        }
    }

    async createAutoFixPR(
        failures: Array<{failure: TestFailure; fixContent: string; filePath: string}>,
        baseBranch: string,
    ): Promise<PRInfo | null> {
        await this.initialized;
        try {
            const branchName = `autofix/test-failures-${Date.now()}`;

            // Create branch
            const branchCreated = await this.createBranch(branchName, baseBranch);
            if (!branchCreated) {
                throw new Error('Failed to create branch');
            }

            // Prepare file changes
            const changes: FileChange[] = failures.map(({filePath, fixContent}) => ({
                path: filePath,
                content: fixContent,
                action: 'modify' as const,
            }));

            // Commit changes
            const commitSha = await this.commitChanges(
                branchName,
                changes,
                `fix: Auto-fix for ${failures.length} failing test(s)`,
            );

            if (!commitSha) {
                throw new Error('Failed to commit changes');
            }

            // Create PR description
            const description = this.generateAutoFixPRDescription(failures);

            // Create pull request
            const pr = await this.createPullRequest({
                sourceBranch: branchName,
                targetBranch: baseBranch,
                title: `🤖 Auto-fix: ${failures.length} failing test(s)`,
                description,
                labels: ['auto-fix', 'test-failure'],
                draft: true, // Create as draft by default for review
            });

            return pr;
        } catch (error: any) {
            console.error('Error creating auto-fix PR:', error.message);
            return null;
        }
    }

    private generateAutoFixPRDescription(
        failures: Array<{failure: TestFailure; fixContent: string; filePath: string}>,
    ): string {
        let description = `## 🤖 Auto-generated Fix for Test Failures\n\n`;
        description += `This PR contains AI-generated fixes for ${failures.length} failing test(s).\n\n`;
        description += `⚠️ **Please review carefully before merging!**\n\n`;
        description += `### Failed Tests\n\n`;

        failures.forEach(({failure}, index) => {
            description += `${index + 1}. **${failure.testTitle}**\n`;
            description += `   - Suite: ${failure.suiteTitle}\n`;
            if (failure.testFile) {
                description += `   - File: \`${failure.testFile}\`\n`;
            }
            description += `   - Error: ${failure.errorCategory}\n\n`;
        });

        description += `### Modified Files\n\n`;
        const uniqueFiles = [...new Set(failures.map((f) => f.filePath))];
        uniqueFiles.forEach((file) => {
            description += `- \`${file}\`\n`;
        });

        description += `\n---\n`;
        description += `_This PR was automatically created by the Playwright AI Test Reporter_`;

        return description;
    }
}
