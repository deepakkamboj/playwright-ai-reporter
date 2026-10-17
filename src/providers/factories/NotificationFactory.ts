/**
 * Factory for creating notification provider instances
 */

import {INotificationProvider} from '../interfaces/INotificationProvider';
import {EmailNotificationProvider, EmailConfig} from '../notifications/EmailNotificationProvider';
import {SlackNotificationProvider} from '../notifications/SlackNotificationProvider';
import {TeamsNotificationProvider} from '../notifications/TeamsNotificationProvider';
import {registerWebhookUrl} from '../notifications/WebhookNotificationProvider';

export type NotificationType = 'email' | 'slack' | 'teams';

export class NotificationFactory {
    /**
     * Load email configuration from environment variables
     */
    private static loadEmailConfigFromEnv() {
        return {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '587', 10),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASSWORD || '',
            },
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
        };
    }

    /**
     * Create a notification provider based on the provider type
     * @param providerType - The type of notification provider to create
     * @param config - Optional configuration for the provider
     * @returns An initialized notification provider instance
     */
    static async createProvider(
        providerType: NotificationType,
        config?: Record<string, unknown>,
    ): Promise<INotificationProvider> {
        let provider: INotificationProvider;

        switch (providerType.toLowerCase()) {
            case 'email': {
                // Load config from environment if not provided
                const emailConfig = config || this.loadEmailConfigFromEnv();
                provider = new EmailNotificationProvider(emailConfig as EmailConfig);
                break;
            }

            case 'slack':
                provider = new SlackNotificationProvider({
                    webhookUrl: registerWebhookUrl(
                        config?.webhookUrl ?? process.env.SLACK_WEBHOOK_URL,
                        'SLACK_WEBHOOK_URL',
                    ),
                });
                break;

            case 'teams':
            case 'microsoft-teams':
                provider = new TeamsNotificationProvider({
                    webhookUrl: registerWebhookUrl(
                        config?.webhookUrl ?? process.env.TEAMS_WEBHOOK_URL,
                        'TEAMS_WEBHOOK_URL',
                    ),
                });
                break;

            default:
                throw new Error(
                    `Unknown notification provider type: ${providerType}. ` + `Supported types: email, slack, teams`,
                );
        }

        return provider;
    }

    /**
     * Create a notification provider from environment variable
     * @param envVarName - Name of the environment variable (default: NOTIFICATION_PROVIDER)
     * @returns An initialized notification provider instance
     */
    static async createFromEnv(envVarName: string = 'NOTIFICATION_PROVIDER'): Promise<INotificationProvider> {
        const providerType = process.env[envVarName];
        if (!providerType) {
            throw new Error(`Environment variable ${envVarName} not set`);
        }
        return this.createProvider(providerType as NotificationType);
    }
}
