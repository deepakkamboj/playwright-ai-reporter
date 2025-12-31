/**
 * Anthropic (Claude) provider implementation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export class AnthropicProvider implements IAIProvider {
    private apiKey: string;
    private baseUrl: string;
    private defaultModel: string;

    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        this.baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
        this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    }

    getName(): string {
        return 'Anthropic';
    }

    async initialize(): Promise<void> {
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
        }
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        const url = `${this.baseUrl}/messages`;

        // Anthropic requires system message to be separate
        const systemMessage = messages.find((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');

        const requestBody: any = {
            model: config?.model || this.defaultModel,
            max_tokens: config?.maxTokens || 1024,
            messages: conversationMessages,
        };

        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }

        if (config) {
            if (config.temperature !== undefined) requestBody.temperature = config.temperature;
            if (config.topP !== undefined) requestBody.top_p = config.topP;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        return {
            content: data.content[0].text,
            usage: data.usage
                ? {
                      promptTokens: data.usage.input_tokens,
                      completionTokens: data.usage.output_tokens,
                      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
                  }
                : undefined,
            model: data.model,
            finishReason: data.stop_reason,
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
            console.error('[Anthropic] Connection test failed:', error);
            return false;
        }
    }
}
