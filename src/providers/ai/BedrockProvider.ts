/**
 * AWS Bedrock provider implementation
 *
 * Uses the Bedrock Runtime Converse API, which provides a unified message
 * format across all Bedrock model families (Anthropic, Meta, Amazon, Mistral, etc.)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {BedrockRuntimeClient, ConverseCommand, type Message} from '@aws-sdk/client-bedrock-runtime';
import {BedrockClient, ListFoundationModelsCommand} from '@aws-sdk/client-bedrock';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export class BedrockProvider implements IAIProvider {
    private region: string;
    private defaultModel: string;
    private client!: BedrockRuntimeClient;

    constructor() {
        this.region = process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
        this.defaultModel = process.env.AWS_BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
    }

    getName(): string {
        return 'AWS Bedrock';
    }

    async initialize(): Promise<void> {
        if (!this.defaultModel) {
            throw new Error('AWS_BEDROCK_MODEL_ID is required for AWS Bedrock provider');
        }

        // Credentials are resolved via the standard AWS SDK provider chain
        // (env vars, shared config/credentials file, or an attached IAM role).
        this.client = new BedrockRuntimeClient({
            region: this.region,
            ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                      credentials: {
                          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                          sessionToken: process.env.AWS_SESSION_TOKEN,
                      },
                  }
                : {}),
        });
    }

    private toBedrockMessages(messages: AIMessage[]): Message[] {
        return messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: [{text: m.content}],
            }));
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        const systemMessage = messages.find((m) => m.role === 'system');
        const modelId = config?.model || this.defaultModel;

        const command = new ConverseCommand({
            modelId,
            messages: this.toBedrockMessages(messages),
            system: systemMessage ? [{text: systemMessage.content}] : undefined,
            inferenceConfig: {
                maxTokens: config?.maxTokens ?? 1024,
                temperature: config?.temperature,
                topP: config?.topP,
            },
        });

        const response = await this.client.send(command);

        const content = response.output?.message?.content?.map((block) => block.text || '').join('') || '';

        if (!content) {
            throw new Error('No content returned from AWS Bedrock Converse API');
        }

        return {
            content,
            usage: response.usage
                ? {
                      promptTokens: response.usage.inputTokens || 0,
                      completionTokens: response.usage.outputTokens || 0,
                      totalTokens: response.usage.totalTokens || 0,
                  }
                : undefined,
            model: modelId,
            finishReason: response.stopReason,
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
            console.error('[Bedrock] Connection test failed:', error);
            return false;
        }
    }

    async getAvailableModels(): Promise<string[]> {
        const managementClient = new BedrockClient({region: this.region});
        const response = await managementClient.send(new ListFoundationModelsCommand({}));
        return (response.modelSummaries || []).map((m: {modelId?: string}) => m.modelId || '').filter(Boolean);
    }
}
