/**
 * Azure OpenAI provider implementation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import type {TokenCredential} from '@azure/identity';
import {
    AzureCliCredential,
    AzurePowerShellCredential,
    ChainedTokenCredential,
    InteractiveBrowserCredential,
} from '@azure/identity';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export class AzureOpenAIProvider implements IAIProvider {
    private endpoint: string;
    private deploymentName: string;
    private apiVersion: string;
    private credential?: TokenCredential;
    private token?: string;
    private tokenExpiry?: number;

    constructor() {
        this.endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
        this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
        this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
    }

    getName(): string {
        return 'Azure OpenAI';
    }

    async initialize(): Promise<void> {
        if (!this.endpoint) {
            throw new Error('AZURE_OPENAI_ENDPOINT is required for Azure OpenAI provider');
        }

        // Create credential chain
        const credentials: TokenCredential[] = [new AzureCliCredential(), new AzurePowerShellCredential()];

        if (process.env.TF_BUILD === undefined) {
            credentials.push(new InteractiveBrowserCredential({}));
        }

        this.credential = new ChainedTokenCredential(...credentials);
        await this.refreshToken();
    }

    private async refreshToken(): Promise<void> {
        if (!this.credential) {
            throw new Error('Credential not initialized');
        }

        const tokenResponse = await this.credential.getToken('https://cognitiveservices.azure.com/.default');
        if (!tokenResponse) {
            throw new Error('Failed to get Azure authentication token');
        }

        this.token = tokenResponse.token;
        this.tokenExpiry = tokenResponse.expiresOnTimestamp;
    }

    private async ensureValidToken(): Promise<void> {
        const now = Date.now();
        // Refresh token 5 minutes before expiry
        if (!this.token || !this.tokenExpiry || this.tokenExpiry - now < 5 * 60 * 1000) {
            await this.refreshToken();
        }
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        await this.ensureValidToken();

        const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

        const requestBody: any = {
            messages: messages,
        };

        if (config) {
            if (config.maxTokens) requestBody.max_tokens = config.maxTokens;
            if (config.temperature !== undefined) requestBody.temperature = config.temperature;
            if (config.topP !== undefined) requestBody.top_p = config.topP;
            if (config.frequencyPenalty !== undefined) requestBody.frequency_penalty = config.frequencyPenalty;
            if (config.presencePenalty !== undefined) requestBody.presence_penalty = config.presencePenalty;
            if (config.responseFormat === 'json') requestBody.response_format = {type: 'json_object'};
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
            throw new Error('Invalid response format from Azure OpenAI API');
        }

        return {
            content: data.choices[0].message.content,
            usage: data.usage
                ? {
                      promptTokens: data.usage.prompt_tokens,
                      completionTokens: data.usage.completion_tokens,
                      totalTokens: data.usage.total_tokens,
                  }
                : undefined,
            model: data.model,
            finishReason: data.choices[0].finish_reason,
        };
    }

    async generateText(prompt: string, config?: AIModelConfig): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful assistant.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ];

        const response = await this.generateCompletion(messages, config);
        return response.content;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.ensureValidToken();
            const response = await this.generateText('Hello', {maxTokens: 10});
            return !!response;
        } catch (error) {
            console.error('[AzureOpenAI] Connection test failed:', error);
            return false;
        }
    }
}
