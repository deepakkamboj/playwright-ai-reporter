/**
 * Central provider registry for managing all provider types
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {IBugTrackerProvider} from './interfaces/IBugTrackerProvider';
import {IDatabaseProvider} from './interfaces/IDatabaseProvider';
import {INotificationProvider} from './interfaces/INotificationProvider';
import {IPRProvider} from './interfaces/IPRProvider';
import {IAIProvider} from './interfaces/IAIProvider';
import {AIProviderFactory, AIProviderType} from './ai/AIProviderFactory';
import {BugTrackerFactory} from './factories/BugTrackerFactory';
import {DatabaseFactory} from './factories/DatabaseFactory';
import {NotificationFactory} from './factories/NotificationFactory';
import {PRProviderFactory} from './factories/PRProviderFactory';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export interface ProviderConfig {
    // Bug Tracker Configuration
    bugTracker?: {
        type: 'azure-devops' | 'github' | 'jira';
        config?: Record<string, any>;
    };

    // Database Configuration
    database?: {
        type: 'sqlite' | 'mysql' | 'postgresql';
        config?: Record<string, any>;
    };

    // Notification Configuration
    notification?: {
        type: 'email' | 'slack' | 'teams';
        config?: Record<string, any>;
    };

    // PR Provider Configuration
    pr?: {
        type: 'github' | 'azure-devops';
        config?: Record<string, any>;
    };

    // AI Provider Configuration
    ai?: {
        type: AIProviderType | string;
        config?: Record<string, any>;
    };
}

/**
 * Centralized provider registry for managing all provider instances
 */
export class ProviderRegistry {
    private static bugTrackerProvider?: IBugTrackerProvider;
    private static databaseProvider?: IDatabaseProvider;
    private static notificationProvider?: INotificationProvider;
    private static prProvider?: IPRProvider;
    private static aiProvider?: IAIProvider;
    private static config?: ProviderConfig;

    /**
     * Initialize the provider registry with configuration
     * @param config - Provider configuration
     */
    static async initialize(config?: ProviderConfig): Promise<void> {
        this.config = config || this.loadConfigFromEnv();
    }

    /**
     * Load configuration from environment variables
     */
    private static loadConfigFromEnv(): ProviderConfig {
        return {
            bugTracker: process.env.BUG_TRACKER_PROVIDER
                ? {
                      type: process.env.BUG_TRACKER_PROVIDER as any,
                  }
                : undefined,
            database: process.env.DATABASE_PROVIDER
                ? {
                      type: process.env.DATABASE_PROVIDER as any,
                  }
                : undefined,
            notification: process.env.NOTIFICATION_PROVIDER
                ? {
                      type: process.env.NOTIFICATION_PROVIDER as any,
                  }
                : undefined,
            pr: process.env.PR_PROVIDER
                ? {
                      type: process.env.PR_PROVIDER as any,
                  }
                : undefined,
            ai: process.env.AI_PROVIDER
                ? {
                      type: process.env.AI_PROVIDER,
                  }
                : undefined,
        };
    }

    /**
     * Get or create bug tracker provider
     */
    static async getBugTrackerProvider(): Promise<IBugTrackerProvider> {
        if (!this.bugTrackerProvider) {
            if (!this.config) {
                await this.initialize();
            }

            const bugTrackerConfig = this.config?.bugTracker;
            if (!bugTrackerConfig) {
                throw new Error('Bug tracker configuration not found');
            }

            this.bugTrackerProvider = await BugTrackerFactory.createProvider(
                bugTrackerConfig.type,
                bugTrackerConfig.config,
            );
        }
        return this.bugTrackerProvider;
    }

    /**
     * Get or create database provider
     */
    static async getDatabaseProvider(): Promise<IDatabaseProvider> {
        if (!this.databaseProvider) {
            if (!this.config) {
                await this.initialize();
            }

            const dbConfig = this.config?.database;
            if (!dbConfig) {
                throw new Error('Database configuration not found');
            }

            this.databaseProvider = await DatabaseFactory.createProvider(dbConfig.type, dbConfig.config);
        }
        return this.databaseProvider;
    }

    /**
     * Get or create notification provider
     */
    static async getNotificationProvider(): Promise<INotificationProvider> {
        if (!this.notificationProvider) {
            if (!this.config) {
                await this.initialize();
            }

            const notificationConfig = this.config?.notification;
            if (!notificationConfig) {
                throw new Error('Notification configuration not found');
            }

            this.notificationProvider = await NotificationFactory.createProvider(
                notificationConfig.type,
                notificationConfig.config,
            );
        }
        return this.notificationProvider;
    }

    /**
     * Get or create PR provider
     */
    static async getPRProvider(): Promise<IPRProvider> {
        if (!this.prProvider) {
            if (!this.config) {
                await this.initialize();
            }

            const prConfig = this.config?.pr;
            if (!prConfig) {
                throw new Error('PR provider configuration not found');
            }

            this.prProvider = await PRProviderFactory.createProvider(prConfig.type, prConfig.config);
        }
        return this.prProvider;
    }

    /**
     * Get or create AI provider
     */
    static async getAIProvider(): Promise<IAIProvider> {
        if (!this.aiProvider) {
            if (!this.config) {
                await this.initialize();
            }

            const aiConfig = this.config?.ai;
            if (!aiConfig) {
                // Default to environment variable or Azure OpenAI
                this.aiProvider = await AIProviderFactory.createFromEnv('AI_PROVIDER');
            } else {
                this.aiProvider = await AIProviderFactory.createProvider(aiConfig.type);
            }
        }
        return this.aiProvider;
    }

    /**
     * Reset all provider instances (useful for testing)
     */
    static reset(): void {
        this.bugTrackerProvider = undefined;
        this.databaseProvider = undefined;
        this.notificationProvider = undefined;
        this.prProvider = undefined;
        this.aiProvider = undefined;
        this.config = undefined;
    }

    /**
     * Close all provider connections
     */
    static async closeAll(): Promise<void> {
        if (this.databaseProvider) {
            await this.databaseProvider.close();
        }
        this.reset();
    }
}
