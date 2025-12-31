/**
 * Mistral AI provider implementation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export class MistralProvider implements IAIProvider {
    private apiKey: string;
    private baseUrl: string;
    private defaultModel: string;

    constructor() {
        this.apiKey = process.env.MISTRAL_API_KEY || '';
        this.baseUrl = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1';
        this.defaultModel = process.env.MISTRAL_MODEL || 'mistral-large-latest';
    }

    getName(): string {
        return 'Mistral AI';
    }

    async initialize(): Promise<void> {
        if (!this.apiKey) {
            throw new Error('MISTRAL_API_KEY is required for Mistral provider');
        }
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        const url = `${this.baseUrl}/chat/completions`;

        const requestBody: any = {
            model: config?.model || this.defaultModel,
            messages: messages,
        };

        if (config) {
            if (config.maxTokens) requestBody.max_tokens = config.maxTokens;
            if (config.temperature !== undefined) requestBody.temperature = config.temperature;
            if (config.topP !== undefined) requestBody.top_p = config.topP;
            if (config.responseFormat === 'json') requestBody.response_format = {type: 'json_object'};
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mistral API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

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
            const response = await this.generateText('Hello', {maxTokens: 10});
            return !!response;
        } catch (error) {
            console.error('[Mistral] Connection test failed:', error);
            return false;
        }
    }

    async getAvailableModels(): Promise<string[]> {
        const url = `${this.baseUrl}/models`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        return data.data.map((model: any) => model.id);
    }
}
