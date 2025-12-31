/**
 * Google AI (Gemini) provider implementation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export class GoogleAIProvider implements IAIProvider {
    private apiKey: string;
    private baseUrl: string;
    private defaultModel: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
        this.baseUrl = process.env.GOOGLE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
        this.defaultModel = process.env.GOOGLE_AI_MODEL || 'gemini-pro';
    }

    getName(): string {
        return 'Google AI';
    }

    async initialize(): Promise<void> {
        if (!this.apiKey) {
            throw new Error('GOOGLE_AI_API_KEY is required for Google AI provider');
        }
    }

    private convertMessagesToGeminiFormat(messages: AIMessage[]): any {
        // Gemini has different format for messages
        const systemMessage = messages.find((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');

        const contents = conversationMessages.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{text: msg.content}],
        }));

        return {
            systemInstruction: systemMessage ? {parts: [{text: systemMessage.content}]} : undefined,
            contents,
        };
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        const model = config?.model || this.defaultModel;
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

        const geminiMessages = this.convertMessagesToGeminiFormat(messages);

        const requestBody: any = {
            ...geminiMessages,
            generationConfig: {},
        };

        if (config) {
            if (config.temperature !== undefined) requestBody.generationConfig.temperature = config.temperature;
            if (config.topP !== undefined) requestBody.generationConfig.topP = config.topP;
            if (config.maxTokens) requestBody.generationConfig.maxOutputTokens = config.maxTokens;
            if (config.responseFormat === 'json') requestBody.generationConfig.responseMimeType = 'application/json';
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google AI API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates in Google AI response');
        }

        const candidate = data.candidates[0];
        const text = candidate.content.parts[0].text;

        return {
            content: text,
            usage: data.usageMetadata
                ? {
                      promptTokens: data.usageMetadata.promptTokenCount,
                      completionTokens: data.usageMetadata.candidatesTokenCount,
                      totalTokens: data.usageMetadata.totalTokenCount,
                  }
                : undefined,
            model: model,
            finishReason: candidate.finishReason,
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
            console.error('[GoogleAI] Connection test failed:', error);
            return false;
        }
    }

    async getAvailableModels(): Promise<string[]> {
        const url = `${this.baseUrl}/models?key=${this.apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        return data.models
            .filter((model: any) => model.supportedGenerationMethods.includes('generateContent'))
            .map((model: any) => model.name.replace('models/', ''));
    }
}
