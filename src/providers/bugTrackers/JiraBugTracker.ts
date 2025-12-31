/**
 * Jira Bug Tracker Provider
 */

import axios, {AxiosInstance} from 'axios';
import {IBugTrackerProvider, BugDetails, BugInfo, BugStatus, BugPriority} from '../interfaces/IBugTrackerProvider';

export interface JiraConfig {
    host: string; // e.g., 'your-domain.atlassian.net'
    email: string;
    apiToken: string;
    projectKey: string;
    issueType?: string; // Default: 'Bug'
}

export class JiraBugTracker implements IBugTrackerProvider {
    private client: AxiosInstance;
    private config: JiraConfig;

    constructor(config: JiraConfig) {
        this.config = config;
        const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

        this.client = axios.create({
            baseURL: `https://${config.host}/rest/api/3`,
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
        });
    }

    async createBug(bugDetails: BugDetails): Promise<BugInfo | null> {
        try {
            // Check if issue already exists
            const existingBugs = await this.findBugs({title: bugDetails.title});

            if (existingBugs.length > 0) {
                console.log(`Jira issue already exists: ${bugDetails.title}. Adding comment.`);
                const existingBug = existingBugs[0];
                await this.addComment(existingBug.id, `Test failed again:\n\n${bugDetails.description}`);
                return existingBug;
            }

            const issueData: any = {
                fields: {
                    project: {
                        key: this.config.projectKey,
                    },
                    summary: bugDetails.title,
                    description: this.formatJiraDescription(bugDetails),
                    issuetype: {
                        name: this.config.issueType || 'Bug',
                    },
                    priority: {
                        name: this.mapPriorityToJira(bugDetails.priority),
                    },
                    labels: ['automated-test', ...(bugDetails.labels || [])],
                },
            };

            if (bugDetails.assignee) {
                issueData.fields.assignee = {accountId: bugDetails.assignee};
            }

            const response = await this.client.post('/issue', issueData);

            console.log(`Created Jira issue: ${response.data.key}`);

            return {
                id: response.data.key,
                url: `https://${this.config.host}/browse/${response.data.key}`,
                status: BugStatus.Open,
                title: bugDetails.title,
            };
        } catch (error: any) {
            console.error('Error creating Jira issue:', error.response?.data || error.message);
            return null;
        }
    }

    async updateBug(bugId: string, updates: Partial<BugDetails>): Promise<BugInfo | null> {
        try {
            const updateData: any = {fields: {}};

            if (updates.title) {
                updateData.fields.summary = updates.title;
            }

            if (updates.description) {
                updateData.fields.description = this.convertToJiraFormat(updates.description);
            }

            if (updates.priority) {
                updateData.fields.priority = {name: this.mapPriorityToJira(updates.priority)};
            }

            if (updates.labels) {
                updateData.fields.labels = ['automated-test', ...updates.labels];
            }

            await this.client.put(`/issue/${bugId}`, updateData);

            const issue = await this.client.get(`/issue/${bugId}`);

            console.log(`Updated Jira issue: ${bugId}`);

            return {
                id: issue.data.key,
                url: `https://${this.config.host}/browse/${issue.data.key}`,
                status: this.mapJiraStatusToStatus(issue.data.fields.status.name),
                title: issue.data.fields.summary,
            };
        } catch (error: any) {
            console.error('Error updating Jira issue:', error.response?.data || error.message);
            return null;
        }
    }

    async closeBug(bugId: string, comment?: string): Promise<BugInfo | null> {
        try {
            if (comment) {
                await this.addComment(bugId, comment);
            }

            // Get available transitions
            const transitionsResponse = await this.client.get(`/issue/${bugId}/transitions`);
            const transitions = transitionsResponse.data.transitions;

            // Find "Done", "Closed", or "Resolved" transition
            const closeTransition = transitions.find((t: any) =>
                ['done', 'closed', 'resolved'].includes(t.name.toLowerCase()),
            );

            if (!closeTransition) {
                console.error('No close transition found for Jira issue');
                return null;
            }

            await this.client.post(`/issue/${bugId}/transitions`, {
                transition: {
                    id: closeTransition.id,
                },
            });

            const issue = await this.client.get(`/issue/${bugId}`);

            console.log(`Closed Jira issue: ${bugId}`);

            return {
                id: issue.data.key,
                url: `https://${this.config.host}/browse/${issue.data.key}`,
                status: BugStatus.Closed,
                title: issue.data.fields.summary,
            };
        } catch (error: any) {
            console.error('Error closing Jira issue:', error.response?.data || error.message);
            return null;
        }
    }

    async findBugs(query: {title?: string; labels?: string[]; status?: BugStatus}): Promise<BugInfo[]> {
        try {
            let jql = `project = ${this.config.projectKey} AND issuetype = Bug`;

            if (query.title) {
                const escapedTitle = query.title.replace(/"/g, '\\"');
                jql += ` AND summary ~ "${escapedTitle}"`;
            }

            if (query.labels && query.labels.length > 0) {
                const labelConditions = query.labels.map((label) => `labels = "${label}"`).join(' AND ');
                jql += ` AND ${labelConditions}`;
            }

            if (query.status === BugStatus.Open) {
                jql += ` AND status NOT IN (Done, Closed, Resolved)`;
            } else if (query.status === BugStatus.Closed) {
                jql += ` AND status IN (Done, Closed, Resolved)`;
            } else if (!query.status) {
                jql += ` AND status NOT IN (Done, Closed, Resolved)`;
            }

            const response = await this.client.post('/search', {
                jql,
                maxResults: 100,
            });

            return response.data.issues.map((issue: any) => ({
                id: issue.key,
                url: `https://${this.config.host}/browse/${issue.key}`,
                status: this.mapJiraStatusToStatus(issue.fields.status.name),
                title: issue.fields.summary,
            }));
        } catch (error: any) {
            console.error('Error finding Jira issues:', error.response?.data || error.message);
            return [];
        }
    }

    async addComment(bugId: string, comment: string): Promise<boolean> {
        try {
            await this.client.post(`/issue/${bugId}/comment`, {
                body: this.convertToJiraFormat(comment),
            });

            console.log(`Added comment to Jira issue: ${bugId}`);
            return true;
        } catch (error: any) {
            console.error('Error adding comment to Jira issue:', error.response?.data || error.message);
            return false;
        }
    }

    private formatJiraDescription(bugDetails: BugDetails): any {
        const failure = bugDetails.testFailure;

        // Jira Cloud uses Atlassian Document Format (ADF)
        return {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'heading',
                    attrs: {level: 2},
                    content: [{type: 'text', text: 'Test Information'}],
                },
                {
                    type: 'paragraph',
                    content: [
                        {type: 'text', text: 'Test: ', marks: [{type: 'strong'}]},
                        {type: 'text', text: failure.testTitle},
                    ],
                },
                {
                    type: 'paragraph',
                    content: [
                        {type: 'text', text: 'Suite: ', marks: [{type: 'strong'}]},
                        {type: 'text', text: failure.suiteTitle},
                    ],
                },
                ...(failure.testFile
                    ? [
                          {
                              type: 'paragraph',
                              content: [
                                  {type: 'text', text: 'File: ', marks: [{type: 'strong'}]},
                                  {type: 'text', text: failure.testFile, marks: [{type: 'code'}]},
                              ],
                          },
                      ]
                    : []),
                {
                    type: 'heading',
                    attrs: {level: 2},
                    content: [{type: 'text', text: 'Error Details'}],
                },
                {
                    type: 'codeBlock',
                    content: [{type: 'text', text: failure.errorMessage}],
                },
                ...(failure.errorStack
                    ? [
                          {
                              type: 'heading',
                              attrs: {level: 2},
                              content: [{type: 'text', text: 'Stack Trace'}],
                          },
                          {
                              type: 'codeBlock',
                              content: [{type: 'text', text: failure.errorStack}],
                          },
                      ]
                    : []),
            ],
        };
    }

    private convertToJiraFormat(text: string): any {
        // Simple conversion to Atlassian Document Format
        return {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text}],
                },
            ],
        };
    }

    private mapPriorityToJira(priority: BugPriority): string {
        switch (priority) {
            case BugPriority.Critical:
                return 'Highest';
            case BugPriority.High:
                return 'High';
            case BugPriority.Medium:
                return 'Medium';
            case BugPriority.Low:
                return 'Low';
            default:
                return 'Medium';
        }
    }

    private mapJiraStatusToStatus(jiraStatus: string): BugStatus {
        const statusLower = jiraStatus.toLowerCase();
        if (statusLower === 'done' || statusLower === 'closed' || statusLower === 'resolved') {
            return BugStatus.Closed;
        }
        if (statusLower === 'in progress' || statusLower === 'in review') {
            return BugStatus.InProgress;
        }
        return BugStatus.Open;
    }
}
