/**
 * Factory for creating bug tracker provider instances
 */

import {IBugTrackerProvider} from '../interfaces/IBugTrackerProvider';
import {AzureDevOpsBugTracker} from '../bugTrackers/AzureDevOpsBugTracker';
import {GitHubBugTracker} from '../bugTrackers/GitHubBugTracker';
import {JiraBugTracker} from '../bugTrackers/JiraBugTracker';

export type BugTrackerType = 'azure-devops' | 'github' | 'jira';

export class BugTrackerFactory {
    /**
     * Create a bug tracker provider based on the provider type
     * @param providerType - The type of bug tracker provider to create
     * @param config - Optional configuration for the provider
     * @returns An initialized bug tracker provider instance
     */
    static async createProvider(
        providerType: BugTrackerType,
        config?: Record<string, any>,
    ): Promise<IBugTrackerProvider> {
        let provider: IBugTrackerProvider;

        switch (providerType.toLowerCase()) {
            case 'azure-devops':
            case 'ado':
            case 'azdo':
                provider = new AzureDevOpsBugTracker(config as any);
                break;

            case 'github':
                provider = new GitHubBugTracker(config as any);
                break;

            case 'jira':
                provider = new JiraBugTracker(config as any);
                break;

            default:
                throw new Error(
                    `Unknown bug tracker provider type: ${providerType}. ` +
                        `Supported types: azure-devops, github, jira`,
                );
        }

        return provider;
    }

    /**
     * Create a bug tracker provider from environment variable
     * @param envVarName - Name of the environment variable (default: BUG_TRACKER_PROVIDER)
     * @returns An initialized bug tracker provider instance
     */
    static async createFromEnv(envVarName: string = 'BUG_TRACKER_PROVIDER'): Promise<IBugTrackerProvider> {
        const providerType = process.env[envVarName];
        if (!providerType) {
            throw new Error(`Environment variable ${envVarName} not set`);
        }
        return this.createProvider(providerType as BugTrackerType);
    }
}
