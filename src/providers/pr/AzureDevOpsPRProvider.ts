/**
 * Azure DevOps Pull Request Provider
 */

import {WebApi, getPersonalAccessTokenHandler} from 'azure-devops-node-api';
import {GitPullRequest, GitPullRequestSearchCriteria} from 'azure-devops-node-api/interfaces/GitInterfaces';
import {IPRProvider, PROptions, PRInfo, FileChange} from '../interfaces/IPRProvider';
import {TestFailure} from '../../types';

export interface AzureDevOpsPRConfig {
    organizationUrl: string;
    project: string;
    repositoryId: string;
    personalAccessToken: string;
}

export class AzureDevOpsPRProvider implements IPRProvider {
    private webApi: WebApi | null = null;
    private config: AzureDevOpsPRConfig;

    constructor(config: AzureDevOpsPRConfig) {
        this.config = config;
    }

    private async getWebApi(): Promise<WebApi> {
        if (this.webApi) {
            return this.webApi;
        }

        const authHandler = getPersonalAccessTokenHandler(this.config.personalAccessToken);
        this.webApi = new WebApi(this.config.organizationUrl, authHandler);
        await this.webApi.connect();
        return this.webApi;
    }

    async createBranch(branchName: string, baseBranch: string): Promise<boolean> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            // Get the base branch commit
            const refs = await gitApi.getRefs(this.config.repositoryId, this.config.project, `heads/${baseBranch}`);

            if (!refs || refs.length === 0) {
                throw new Error(`Base branch ${baseBranch} not found`);
            }

            const baseSha = refs[0].objectId;

            // Create new branch
            await gitApi.updateRefs(
                [
                    {
                        name: `refs/heads/${branchName}`,
                        oldObjectId: '0000000000000000000000000000000000000000',
                        newObjectId: baseSha,
                    },
                ],
                this.config.repositoryId,
                this.config.project,
            );

            console.log(`Created branch: ${branchName} from ${baseBranch}`);
            return true;
        } catch (error: any) {
            console.error('Error creating branch:', error.message);
            return false;
        }
    }

    async commitChanges(branchName: string, changes: FileChange[], commitMessage: string): Promise<string | null> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            // Prepare changes for push
            const pushChanges = changes.map((change) => {
                const changeType = change.action === 'add' ? 1 : change.action === 'modify' ? 2 : 3; // Add = 1, Edit = 2, Delete = 3

                return {
                    changeType,
                    item: {path: change.path},
                    newContent:
                        change.action !== 'delete'
                            ? {
                                  content: change.content,
                                  contentType: 0, // RawText = 0
                              }
                            : undefined,
                };
            });

            // Create push
            const push = await gitApi.createPush(
                {
                    refUpdates: [
                        {
                            name: `refs/heads/${branchName}`,
                            oldObjectId: undefined, // Will be filled by API
                        },
                    ],
                    commits: [
                        {
                            comment: commitMessage,
                            changes: pushChanges,
                        },
                    ],
                },
                this.config.repositoryId,
                this.config.project,
            );

            if (!push || !push.commits || push.commits.length === 0) {
                throw new Error('Failed to create commit');
            }

            const commitId = push.commits[0].commitId!;
            console.log(`Committed changes to ${branchName}: ${commitId}`);
            return commitId;
        } catch (error: any) {
            console.error('Error committing changes:', error.message);
            return null;
        }
    }

    async createPullRequest(options: PROptions): Promise<PRInfo | null> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            const pr: GitPullRequest = await gitApi.createPullRequest(
                {
                    sourceRefName: `refs/heads/${options.sourceBranch}`,
                    targetRefName: `refs/heads/${options.targetBranch}`,
                    title: options.title,
                    description: options.description,
                    isDraft: options.draft,
                },
                this.config.repositoryId,
                this.config.project,
            );

            // Add reviewers if specified
            if (options.reviewers && options.reviewers.length > 0) {
                for (const reviewer of options.reviewers) {
                    await gitApi.createPullRequestReviewer(
                        {id: reviewer},
                        this.config.repositoryId,
                        pr.pullRequestId!,
                        reviewer,
                        this.config.project,
                    );
                }
            }

            // Add labels if specified
            if (options.labels && options.labels.length > 0) {
                await gitApi.createPullRequestLabel(
                    {name: options.labels.join(',')},
                    this.config.repositoryId,
                    pr.pullRequestId!,
                    undefined,
                    this.config.project,
                );
            }

            console.log(`Created pull request: #${pr.pullRequestId}`);

            return {
                id: pr.pullRequestId!.toString(),
                number: pr.pullRequestId!,
                url: `${this.config.organizationUrl}/${this.config.project}/_git/${this.config.repositoryId}/pullrequest/${pr.pullRequestId}`,
                status: this.mapAdoStatusToPRStatus(pr.status!),
                sourceBranch: options.sourceBranch,
                targetBranch: options.targetBranch,
            };
        } catch (error: any) {
            console.error('Error creating pull request:', error.message);
            return null;
        }
    }

    async updatePullRequest(prId: string, updates: Partial<PROptions>): Promise<PRInfo | null> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            const prIdNum = parseInt(prId);
            const updateData: any = {};

            if (updates.title) updateData.title = updates.title;
            if (updates.description) updateData.description = updates.description;
            if (updates.draft !== undefined) updateData.isDraft = updates.draft;

            const pr = await gitApi.updatePullRequest(
                updateData,
                this.config.repositoryId,
                prIdNum,
                this.config.project,
            );

            return {
                id: pr.pullRequestId!.toString(),
                number: pr.pullRequestId!,
                url: `${this.config.organizationUrl}/${this.config.project}/_git/${this.config.repositoryId}/pullrequest/${pr.pullRequestId}`,
                status: this.mapAdoStatusToPRStatus(pr.status!),
                sourceBranch: pr.sourceRefName?.replace('refs/heads/', '') || '',
                targetBranch: pr.targetRefName?.replace('refs/heads/', '') || '',
            };
        } catch (error: any) {
            console.error('Error updating pull request:', error.message);
            return null;
        }
    }

    async addComment(prId: string, comment: string): Promise<boolean> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            const prIdNum = parseInt(prId);
            const thread = await gitApi.createThread(
                {
                    comments: [
                        {
                            content: comment,
                            commentType: 1, // Text = 1
                        },
                    ],
                },
                this.config.repositoryId,
                prIdNum,
                this.config.project,
            );

            console.log(`Added comment to PR #${prIdNum}`);
            return true;
        } catch (error: any) {
            console.error('Error adding comment to pull request:', error.message);
            return false;
        }
    }

    async closePullRequest(prId: string, comment?: string): Promise<boolean> {
        try {
            const webApi = await this.getWebApi();
            const gitApi = await webApi.getGitApi();

            const prIdNum = parseInt(prId);

            if (comment) {
                await this.addComment(prId, comment);
            }

            await gitApi.updatePullRequest(
                {status: 2}, // Abandoned = 2
                this.config.repositoryId,
                prIdNum,
                this.config.project,
            );

            console.log(`Closed PR #${prIdNum}`);
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
            const commitId = await this.commitChanges(
                branchName,
                changes,
                `Auto-fix for ${failures.length} failing test(s)`,
            );

            if (!commitId) {
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
                draft: true,
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

    private mapAdoStatusToPRStatus(status: number): 'open' | 'merged' | 'closed' {
        // Active = 1, Abandoned = 2, Completed = 3
        if (status === 3) return 'merged';
        if (status === 2) return 'closed';
        return 'open';
    }
}
