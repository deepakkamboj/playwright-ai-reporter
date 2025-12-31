/**
 * Factory for creating PR provider instances
 */

import {IPRProvider} from '../interfaces/IPRProvider';
import {GitHubPRProvider} from '../pr/GitHubPRProvider';
import {AzureDevOpsPRProvider} from '../pr/AzureDevOpsPRProvider';

export type PRProviderType = 'github' | 'azure-devops';

export class PRProviderFactory {
    /**
     * Create a PR provider based on the provider type
     * @param providerType - The type of PR provider to create
     * @param config - Optional configuration for the provider
     * @returns An initialized PR provider instance
     */
    static async createProvider(providerType: PRProviderType, config?: Record<string, any>): Promise<IPRProvider> {
        let provider: IPRProvider;

        switch (providerType.toLowerCase()) {
            case 'github':
                provider = new GitHubPRProvider(config as any);
                break;

            case 'azure-devops':
            case 'ado':
            case 'azdo':
                provider = new AzureDevOpsPRProvider(config as any);
                break;

            default:
                throw new Error(
                    `Unknown PR provider type: ${providerType}. ` + `Supported types: github, azure-devops`,
                );
        }

        return provider;
    }

    /**
     * Create a PR provider from environment variable
     * @param envVarName - Name of the environment variable (default: PR_PROVIDER)
     * @returns An initialized PR provider instance
     */
    static async createFromEnv(envVarName: string = 'PR_PROVIDER'): Promise<IPRProvider> {
        const providerType = process.env[envVarName];
        if (!providerType) {
            throw new Error(`Environment variable ${envVarName} not set`);
        }
        return this.createProvider(providerType as PRProviderType);
    }
}
