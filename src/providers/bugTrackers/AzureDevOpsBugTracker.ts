/**
 * Azure DevOps Bug Tracker Provider
 */

import {getPersonalAccessTokenHandler, WebApi} from 'azure-devops-node-api';
import {JsonPatchOperation, Operation} from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import {IBugTrackerProvider, BugDetails, BugInfo, BugStatus, BugPriority} from '../interfaces/IBugTrackerProvider';

export interface AzureDevOpsConfig {
    organizationUrl: string;
    project: string;
    personalAccessToken: string;
    areaPath?: string;
    iterationPath?: string;
    tags?: string[];
}

export class AzureDevOpsBugTracker implements IBugTrackerProvider {
    private webApi: WebApi | null = null;
    private config: AzureDevOpsConfig;

    constructor(config: AzureDevOpsConfig) {
        this.config = config;
    }

    private async getWebApi(): Promise<WebApi | null> {
        if (this.webApi) {
            return this.webApi;
        }

        try {
            const authHandler = getPersonalAccessTokenHandler(this.config.personalAccessToken);
            this.webApi = new WebApi(this.config.organizationUrl, authHandler);
            await this.webApi.connect();
            console.log('Connected to Azure DevOps successfully');
            return this.webApi;
        } catch (error) {
            console.error('Failed to connect to Azure DevOps:', error);
            return null;
        }
    }

    async createBug(bugDetails: BugDetails): Promise<BugInfo | null> {
        try {
            // Check if bug already exists
            const existingBugs = await this.findBugs({title: bugDetails.title});

            if (existingBugs.length > 0) {
                console.log(`Bug already exists: ${bugDetails.title}. Updating existing bug.`);
                const existingBug = existingBugs[0];
                await this.addComment(existingBug.id, `Test failed again:\n${bugDetails.description}`);
                return existingBug;
            }

            const webApi = await this.getWebApi();
            if (!webApi) {
                throw new Error('Failed to connect to Azure DevOps');
            }

            const workItemsApi = await webApi.getWorkItemTrackingApi();

            const operations: JsonPatchOperation[] = [
                {op: Operation.Add, path: '/fields/System.Title', value: bugDetails.title},
                {op: Operation.Add, path: '/fields/System.Description', value: bugDetails.description},
                {
                    op: Operation.Add,
                    path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
                    value: this.formatReproSteps(bugDetails),
                },
                {
                    op: Operation.Add,
                    path: '/fields/System.AreaPath',
                    value: this.config.areaPath || this.config.project,
                },
                {
                    op: Operation.Add,
                    path: '/fields/System.IterationPath',
                    value: this.config.iterationPath || this.config.project,
                },
            ];

            // Add priority
            const priority = this.mapPriorityToAdo(bugDetails.priority);
            operations.push({op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.Priority', value: priority});

            // Add tags
            const tags = [...(this.config.tags || []), ...(bugDetails.labels || []), 'AutomatedTest'];
            operations.push({op: Operation.Add, path: '/fields/System.Tags', value: tags.join('; ')});

            // Add additional fields
            if (bugDetails.additionalFields) {
                for (const [key, value] of Object.entries(bugDetails.additionalFields)) {
                    operations.push({op: Operation.Add, path: `/fields/${key}`, value});
                }
            }

            const workItem = await workItemsApi.createWorkItem(undefined, operations, this.config.project, 'Bug');

            if (!workItem || !workItem.id) {
                throw new Error('Failed to create work item');
            }

            console.log(`Created Azure DevOps bug: ${workItem.id}`);

            return {
                id: workItem.id.toString(),
                url:
                    workItem._links?.html?.href ||
                    `${this.config.organizationUrl}/${this.config.project}/_workitems/edit/${workItem.id}`,
                status: BugStatus.Open,
                title: bugDetails.title,
            };
        } catch (error) {
            console.error('Error creating Azure DevOps bug:', error);
            return null;
        }
    }

    async updateBug(bugId: string, updates: Partial<BugDetails>): Promise<BugInfo | null> {
        try {
            const webApi = await this.getWebApi();
            if (!webApi) {
                throw new Error('Failed to connect to Azure DevOps');
            }

            const workItemsApi = await webApi.getWorkItemTrackingApi();
            const operations: JsonPatchOperation[] = [];

            if (updates.title) {
                operations.push({op: Operation.Add, path: '/fields/System.Title', value: updates.title});
            }

            if (updates.description) {
                operations.push({op: Operation.Add, path: '/fields/System.History', value: updates.description});
            }

            if (updates.priority) {
                const priority = this.mapPriorityToAdo(updates.priority);
                operations.push({op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.Priority', value: priority});
            }

            if (updates.labels) {
                operations.push({op: Operation.Add, path: '/fields/System.Tags', value: updates.labels.join('; ')});
            }

            const workItem = await workItemsApi.updateWorkItem(
                undefined,
                operations,
                parseInt(bugId),
                this.config.project,
            );

            if (!workItem || !workItem.id) {
                throw new Error('Failed to update work item');
            }

            console.log(`Updated Azure DevOps bug: ${workItem.id}`);

            return {
                id: workItem.id.toString(),
                url:
                    workItem._links?.html?.href ||
                    `${this.config.organizationUrl}/${this.config.project}/_workitems/edit/${workItem.id}`,
                status: this.mapAdoStateToStatus(workItem.fields?.['System.State']),
                title: workItem.fields?.['System.Title'] || '',
            };
        } catch (error) {
            console.error('Error updating Azure DevOps bug:', error);
            return null;
        }
    }

    async closeBug(bugId: string, comment?: string): Promise<BugInfo | null> {
        try {
            const webApi = await this.getWebApi();
            if (!webApi) {
                throw new Error('Failed to connect to Azure DevOps');
            }

            const workItemsApi = await webApi.getWorkItemTrackingApi();
            const operations: JsonPatchOperation[] = [
                {op: Operation.Add, path: '/fields/System.State', value: 'Closed'},
            ];

            if (comment) {
                operations.push({op: Operation.Add, path: '/fields/System.History', value: comment});
            }

            const workItem = await workItemsApi.updateWorkItem(
                undefined,
                operations,
                parseInt(bugId),
                this.config.project,
            );

            if (!workItem || !workItem.id) {
                throw new Error('Failed to close work item');
            }

            console.log(`Closed Azure DevOps bug: ${workItem.id}`);

            return {
                id: workItem.id.toString(),
                url:
                    workItem._links?.html?.href ||
                    `${this.config.organizationUrl}/${this.config.project}/_workitems/edit/${workItem.id}`,
                status: BugStatus.Closed,
                title: workItem.fields?.['System.Title'] || '',
            };
        } catch (error) {
            console.error('Error closing Azure DevOps bug:', error);
            return null;
        }
    }

    async findBugs(query: {title?: string; labels?: string[]; status?: BugStatus}): Promise<BugInfo[]> {
        try {
            const webApi = await this.getWebApi();
            if (!webApi) {
                throw new Error('Failed to connect to Azure DevOps');
            }

            const workItemsApi = await webApi.getWorkItemTrackingApi();

            // Build WIQL query
            let wiqlQuery = `SELECT [System.Id], [System.Title], [System.State] FROM workitems WHERE [System.TeamProject] = @project AND [System.WorkItemType] = 'Bug'`;

            if (query.title) {
                const escapedTitle = query.title.replace(/'/g, "''");
                wiqlQuery += ` AND [System.Title] = '${escapedTitle}'`;
            }

            if (query.labels && query.labels.length > 0) {
                const labelConditions = query.labels.map((label) => `[System.Tags] CONTAINS '${label}'`).join(' AND ');
                wiqlQuery += ` AND ${labelConditions}`;
            }

            if (query.status) {
                const adoState = this.mapStatusToAdoState(query.status);
                wiqlQuery += ` AND [System.State] = '${adoState}'`;
            } else {
                // By default, exclude closed bugs
                wiqlQuery += ` AND [System.State] <> 'Closed' AND [System.State] <> 'Done' AND [System.State] <> 'Resolved'`;
            }

            const result = await workItemsApi.queryByWiql({query: wiqlQuery}, {project: this.config.project});

            if (!result?.workItems || result.workItems.length === 0) {
                return [];
            }

            const workItemIds = result.workItems.map((item) => item.id).filter((id): id is number => id !== undefined);

            if (workItemIds.length === 0) {
                return [];
            }

            const workItems = await workItemsApi.getWorkItems(workItemIds, undefined, undefined, undefined, undefined);

            return workItems.map((item) => ({
                id: item.id?.toString() || '',
                url:
                    item._links?.html?.href ||
                    `${this.config.organizationUrl}/${this.config.project}/_workitems/edit/${item.id}`,
                status: this.mapAdoStateToStatus(item.fields?.['System.State']),
                title: item.fields?.['System.Title'] || '',
            }));
        } catch (error) {
            console.error('Error finding Azure DevOps bugs:', error);
            return [];
        }
    }

    async addComment(bugId: string, comment: string): Promise<boolean> {
        try {
            const webApi = await this.getWebApi();
            if (!webApi) {
                throw new Error('Failed to connect to Azure DevOps');
            }

            const workItemsApi = await webApi.getWorkItemTrackingApi();
            const operations: JsonPatchOperation[] = [
                {op: Operation.Add, path: '/fields/System.History', value: comment},
            ];

            await workItemsApi.updateWorkItem(undefined, operations, parseInt(bugId), this.config.project);

            console.log(`Added comment to Azure DevOps bug: ${bugId}`);
            return true;
        } catch (error) {
            console.error('Error adding comment to Azure DevOps bug:', error);
            return false;
        }
    }

    private formatReproSteps(bugDetails: BugDetails): string {
        const failure = bugDetails.testFailure;
        let steps = `<div><strong>Test Information:</strong></div>`;
        steps += `<div>Test: ${failure.testTitle}</div>`;
        steps += `<div>Suite: ${failure.suiteTitle}</div>`;

        if (failure.testFile) {
            steps += `<div>File: ${failure.testFile}</div>`;
        }

        if (failure.location) {
            steps += `<div>Location: Line ${failure.location.line}, Column ${failure.location.column}</div>`;
        }

        steps += `<div><br/><strong>Error Details:</strong></div>`;
        steps += `<div><pre>${this.escapeHtml(failure.errorMessage)}</pre></div>`;

        if (failure.errorStack) {
            steps += `<div><br/><strong>Stack Trace:</strong></div>`;
            steps += `<div><pre>${this.escapeHtml(failure.errorStack)}</pre></div>`;
        }

        return steps;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private mapPriorityToAdo(priority: BugPriority): number {
        switch (priority) {
            case BugPriority.Critical:
                return 1;
            case BugPriority.High:
                return 2;
            case BugPriority.Medium:
                return 3;
            case BugPriority.Low:
                return 4;
            default:
                return 3;
        }
    }

    private mapAdoStateToStatus(state: string): BugStatus {
        const stateLower = state?.toLowerCase() || '';
        if (stateLower === 'closed' || stateLower === 'done' || stateLower === 'resolved') {
            return BugStatus.Closed;
        }
        if (stateLower === 'active' || stateLower === 'committed') {
            return BugStatus.InProgress;
        }
        return BugStatus.Open;
    }

    private mapStatusToAdoState(status: BugStatus): string {
        switch (status) {
            case BugStatus.Closed:
                return 'Closed';
            case BugStatus.InProgress:
                return 'Active';
            case BugStatus.Open:
                return 'New';
            default:
                return 'New';
        }
    }
}
