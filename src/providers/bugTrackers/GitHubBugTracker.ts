/**
 * GitHub Bug Tracker Provider
 */

import {IBugTrackerProvider, BugDetails, BugInfo, BugStatus, BugPriority} from '../interfaces/IBugTrackerProvider';

export interface GitHubConfig {
    owner: string;
    repo: string;
    token: string;
}

export class GitHubBugTracker implements IBugTrackerProvider {
    private octokit: any;
    private config: GitHubConfig;
    private initialized: Promise<void>;

    constructor(config: GitHubConfig) {
        this.config = config;
        this.initialized = this.initialize();
    }

    private async initialize(): Promise<void> {
        const {Octokit} = await import('@octokit/rest');
        this.octokit = new Octokit({auth: this.config.token});
    }

    async createBug(bugDetails: BugDetails): Promise<BugInfo | null> {
        await this.initialized;
        try {
            // Check if issue already exists
            const existingBugs = await this.findBugs({title: bugDetails.title});

            if (existingBugs.length > 0) {
                console.log(`Issue already exists: ${bugDetails.title}. Adding comment.`);
                const existingBug = existingBugs[0];
                await this.addComment(existingBug.id, `Test failed again:\n\n${bugDetails.description}`);
                return existingBug;
            }

            const labels = ['bug', 'automated-test', ...(bugDetails.labels || [])];

            // Add priority label
            labels.push(this.mapPriorityToLabel(bugDetails.priority));

            const body = this.formatIssueBody(bugDetails);

            const response = await this.octokit.issues.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title: bugDetails.title,
                body,
                labels,
                assignees: bugDetails.assignee ? [bugDetails.assignee] : undefined,
            });

            console.log(`Created GitHub issue: #${response.data.number}`);

            return {
                id: response.data.number.toString(),
                url: response.data.html_url,
                status: BugStatus.Open,
                title: response.data.title,
            };
        } catch (error) {
            console.error('Error creating GitHub issue:', error);
            return null;
        }
    }

    async updateBug(bugId: string, updates: Partial<BugDetails>): Promise<BugInfo | null> {
        await this.initialized;
        try {
            const issueNumber = parseInt(bugId);
            const updateData: any = {};

            if (updates.title) {
                updateData.title = updates.title;
            }

            if (updates.description) {
                updateData.body = updates.description;
            }

            if (updates.labels) {
                updateData.labels = ['bug', 'automated-test', ...updates.labels];
                if (updates.priority) {
                    updateData.labels.push(this.mapPriorityToLabel(updates.priority));
                }
            }

            const response = await this.octokit.issues.update({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                ...updateData,
            });

            console.log(`Updated GitHub issue: #${response.data.number}`);

            return {
                id: response.data.number.toString(),
                url: response.data.html_url,
                status: this.mapGitHubStateToStatus(response.data.state),
                title: response.data.title,
            };
        } catch (error) {
            console.error('Error updating GitHub issue:', error);
            return null;
        }
    }

    async closeBug(bugId: string, comment?: string): Promise<BugInfo | null> {
        await this.initialized;
        try {
            const issueNumber = parseInt(bugId);

            if (comment) {
                await this.addComment(bugId, comment);
            }

            const response = await this.octokit.issues.update({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                state: 'closed',
            });

            console.log(`Closed GitHub issue: #${response.data.number}`);

            return {
                id: response.data.number.toString(),
                url: response.data.html_url,
                status: BugStatus.Closed,
                title: response.data.title,
            };
        } catch (error) {
            console.error('Error closing GitHub issue:', error);
            return null;
        }
    }

    async findBugs(query: {title?: string; labels?: string[]; status?: BugStatus}): Promise<BugInfo[]> {
        await this.initialized;
        try {
            let searchQuery = `repo:${this.config.owner}/${this.config.repo} is:issue label:bug`;

            if (query.title) {
                searchQuery += ` "${query.title}" in:title`;
            }

            if (query.labels && query.labels.length > 0) {
                searchQuery += ` ${query.labels.map((label) => `label:${label}`).join(' ')}`;
            }

            if (query.status === BugStatus.Open) {
                searchQuery += ' is:open';
            } else if (query.status === BugStatus.Closed) {
                searchQuery += ' is:closed';
            } else if (!query.status) {
                searchQuery += ' is:open';
            }

            const response = await this.octokit.search.issuesAndPullRequests({
                q: searchQuery,
                per_page: 100,
            });

            return response.data.items.map((issue: any) => ({
                id: issue.number.toString(),
                url: issue.html_url,
                status: this.mapGitHubStateToStatus(issue.state),
                title: issue.title,
            }));
        } catch (error) {
            console.error('Error finding GitHub issues:', error);
            return [];
        }
    }

    async addComment(bugId: string, comment: string): Promise<boolean> {
        await this.initialized;
        try {
            const issueNumber = parseInt(bugId);

            await this.octokit.issues.createComment({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                body: comment,
            });

            console.log(`Added comment to GitHub issue: #${issueNumber}`);
            return true;
        } catch (error) {
            console.error('Error adding comment to GitHub issue:', error);
            return false;
        }
    }

    private formatIssueBody(bugDetails: BugDetails): string {
        const failure = bugDetails.testFailure;
        let body = `## Test Information\n\n`;
        body += `- **Test:** ${failure.testTitle}\n`;
        body += `- **Suite:** ${failure.suiteTitle}\n`;

        if (failure.testFile) {
            body += `- **File:** \`${failure.testFile}\`\n`;
        }

        if (failure.location) {
            body += `- **Location:** Line ${failure.location.line}, Column ${failure.location.column}\n`;
        }

        body += `\n## Error Details\n\n`;
        body += `\`\`\`\n${failure.errorMessage}\n\`\`\`\n`;

        if (failure.errorStack) {
            body += `\n## Stack Trace\n\n`;
            body += `<details>\n<summary>View stack trace</summary>\n\n`;
            body += `\`\`\`\n${failure.errorStack}\n\`\`\`\n`;
            body += `</details>\n`;
        }

        body += `\n---\n_This issue was automatically created by the Playwright AI Test Reporter_`;

        return body;
    }

    private mapPriorityToLabel(priority: BugPriority): string {
        switch (priority) {
            case BugPriority.Critical:
                return 'priority: critical';
            case BugPriority.High:
                return 'priority: high';
            case BugPriority.Medium:
                return 'priority: medium';
            case BugPriority.Low:
                return 'priority: low';
            default:
                return 'priority: medium';
        }
    }

    private mapGitHubStateToStatus(state: string): BugStatus {
        return state === 'closed' ? BugStatus.Closed : BugStatus.Open;
    }
}
