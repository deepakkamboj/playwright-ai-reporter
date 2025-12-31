/**
 * Factory for creating AI provider instances
 */

import {IAIProvider} from '../interfaces/IAIProvider';
import {AzureOpenAIProvider} from './AzureOpenAIProvider';
import {OpenAIProvider} from './OpenAIProvider';
import {AnthropicProvider} from './AnthropicProvider';
import {GoogleAIProvider} from './GoogleAIProvider';
import {MistralProvider} from './MistralProvider';

export enum AIProviderType {
    AzureOpenAI = 'azure-openai',
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    GoogleAI = 'google-ai',
    Mistral = 'mistral',
}

export class AIProviderFactory {
    /**
     * Create an AI provider based on the provider type
     * @param providerType - The type of AI provider to create
     * @returns An initialized AI provider instance
     */
    static async createProvider(providerType: AIProviderType | string): Promise<IAIProvider> {
        let provider: IAIProvider;

        switch (providerType.toLowerCase()) {
            case AIProviderType.AzureOpenAI:
            case 'azure':
            case 'azure-openai':
                provider = new AzureOpenAIProvider();
                break;

            case AIProviderType.OpenAI:
            case 'openai':
                provider = new OpenAIProvider();
                break;

            case AIProviderType.Anthropic:
            case 'anthropic':
            case 'claude':
                provider = new AnthropicProvider();
                break;

            case AIProviderType.GoogleAI:
            case 'google':
            case 'google-ai':
            case 'gemini':
                provider = new GoogleAIProvider();
                break;

            case AIProviderType.Mistral:
            case 'mistral':
                provider = new MistralProvider();
                break;

            default:
                throw new Error(
                    `Unknown AI provider type: ${providerType}. ` +
                        `Supported types: ${Object.values(AIProviderType).join(', ')}`,
                );
        }

        await provider.initialize();
        return provider;
    }

    /**
     * Create an AI provider from environment variable
     * @param envVarName - Name of the environment variable (default: AI_PROVIDER)
     * @returns An initialized AI provider instance
     */
    static async createFromEnv(envVarName: string = 'AI_PROVIDER'): Promise<IAIProvider> {
        const providerType = process.env[envVarName] || AIProviderType.AzureOpenAI;
        return this.createProvider(providerType);
    }

    /**
     * Get list of supported AI provider types
     */
    static getSupportedProviders(): string[] {
        return Object.values(AIProviderType);
    }

    /**
     * Validate if a provider type is supported
     */
    static isProviderSupported(providerType: string): boolean {
        return this.getSupportedProviders().includes(providerType.toLowerCase());
    }
}
