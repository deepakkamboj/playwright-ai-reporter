/**
 * Interface for AI providers (Azure OpenAI, OpenAI, Anthropic, Google AI, etc.)
 */

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIModelConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    responseFormat?: 'text' | 'json';
}

export interface AIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

export interface IAIProvider {
    /**
     * Get provider name
     */
    getName(): string;

    /**
     * Initialize the AI provider with credentials
     */
    initialize(): Promise<void>;

    /**
     * Generate a completion based on messages
     * @param messages - Array of conversation messages
     * @param config - Optional model configuration
     * @returns AI response
     */
    generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse>;

    /**
     * Generate a simple text completion from a prompt
     * @param prompt - The prompt text
     * @param config - Optional model configuration
     * @returns Generated text
     */
    generateText(prompt: string, config?: AIModelConfig): Promise<string>;

    /**
     * Test the connection to the AI service
     * @returns Whether the connection is successful
     */
    testConnection(): Promise<boolean>;

    /**
     * Get available models for this provider
     */
    getAvailableModels?(): Promise<string[]>;
}
