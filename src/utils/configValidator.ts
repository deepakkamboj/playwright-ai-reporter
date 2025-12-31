/**
 * Configuration validator and diagnostic tool
 *
 * This utility helps validate provider configurations and diagnose issues
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {ProviderRegistry} from '../providers/ProviderRegistry';
import {AIProviderFactory} from '../providers/ai/AIProviderFactory';
import {BugTrackerFactory} from '../providers/factories/BugTrackerFactory';
import {DatabaseFactory} from '../providers/factories/DatabaseFactory';
import {NotificationFactory} from '../providers/factories/NotificationFactory';
import {PRProviderFactory} from '../providers/factories/PRProviderFactory';

dotenv.config({path: path.resolve(process.cwd(), '.env')});

export interface ValidationResult {
    provider: string;
    valid: boolean;
    configured: boolean;
    connected?: boolean;
    message: string;
    details?: any;
}

export class ConfigValidator {
    /**
     * Validate all configured providers
     */
    static async validateAll(): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];

        console.log('\n=== Provider Configuration Validation ===\n');

        // Validate AI Provider
        results.push(await this.validateAIProvider());

        // Validate Bug Tracker (if configured)
        if (process.env.BUG_TRACKER_PROVIDER) {
            results.push(await this.validateBugTracker());
        }

        // Validate Database (if configured)
        if (process.env.DATABASE_PROVIDER) {
            results.push(await this.validateDatabase());
        }

        // Validate Notification Provider (if configured)
        if (process.env.NOTIFICATION_PROVIDER) {
            results.push(await this.validateNotificationProvider());
        }

        // Validate PR Provider (if configured)
        if (process.env.PR_PROVIDER) {
            results.push(await this.validatePRProvider());
        }

        this.printResults(results);

        return results;
    }

    /**
     * Validate AI provider configuration
     */
    private static async validateAIProvider(): Promise<ValidationResult> {
        const providerType = process.env.AI_PROVIDER || 'azure-openai';

        try {
            // Check if provider type is supported
            if (!AIProviderFactory.isProviderSupported(providerType)) {
                return {
                    provider: 'AI Provider',
                    valid: false,
                    configured: false,
                    message: `Unsupported AI provider: ${providerType}`,
                    details: {supportedProviders: AIProviderFactory.getSupportedProviders()},
                };
            }

            // Check provider-specific configuration
            const configCheck = this.checkAIProviderConfig(providerType);
            if (!configCheck.valid) {
                return {
                    provider: 'AI Provider',
                    valid: false,
                    configured: false,
                    message: configCheck.message,
                    details: configCheck.details,
                };
            }

            // Try to initialize and test connection
            const provider = await AIProviderFactory.createProvider(providerType);
            const connected = await provider.testConnection();

            return {
                provider: `AI Provider (${provider.getName()})`,
                valid: true,
                configured: true,
                connected,
                message: connected ? 'Successfully connected' : 'Configuration valid but connection failed',
            };
        } catch (error) {
            return {
                provider: 'AI Provider',
                valid: false,
                configured: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Check AI provider specific configuration
     */
    private static checkAIProviderConfig(providerType: string): {valid: boolean; message: string; details?: any} {
        const checks: Record<string, string[]> = {
            'azure-openai': ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_DEPLOYMENT_NAME'],
            openai: ['OPENAI_API_KEY'],
            anthropic: ['ANTHROPIC_API_KEY'],
            'google-ai': ['GOOGLE_AI_API_KEY'],
            mistral: ['MISTRAL_API_KEY'],
        };

        const requiredVars = checks[providerType] || [];
        const missing = requiredVars.filter((v) => !process.env[v]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required environment variables: ${missing.join(', ')}`,
                details: {required: requiredVars, missing},
            };
        }

        return {valid: true, message: 'Configuration complete'};
    }

    /**
     * Validate bug tracker configuration
     */
    private static async validateBugTracker(): Promise<ValidationResult> {
        const providerType = process.env.BUG_TRACKER_PROVIDER;

        try {
            if (!providerType) {
                return {
                    provider: 'Bug Tracker',
                    valid: false,
                    configured: false,
                    message: 'BUG_TRACKER_PROVIDER not set',
                };
            }

            const configCheck = this.checkBugTrackerConfig(providerType);
            if (!configCheck.valid) {
                return {
                    provider: 'Bug Tracker',
                    valid: false,
                    configured: false,
                    message: configCheck.message,
                    details: configCheck.details,
                };
            }

            // Try to initialize
            const provider = await BugTrackerFactory.createProvider(providerType as any);

            return {
                provider: `Bug Tracker (${providerType})`,
                valid: true,
                configured: true,
                message: 'Configuration valid',
            };
        } catch (error) {
            return {
                provider: 'Bug Tracker',
                valid: false,
                configured: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Check bug tracker specific configuration
     */
    private static checkBugTrackerConfig(providerType: string): {valid: boolean; message: string; details?: any} {
        const checks: Record<string, string[]> = {
            'azure-devops': ['AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT'],
            github: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
            jira: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
        };

        const requiredVars = checks[providerType] || [];
        const missing = requiredVars.filter((v) => !process.env[v]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required environment variables: ${missing.join(', ')}`,
                details: {required: requiredVars, missing},
            };
        }

        return {valid: true, message: 'Configuration complete'};
    }

    /**
     * Validate database configuration
     */
    private static async validateDatabase(): Promise<ValidationResult> {
        const providerType = process.env.DATABASE_PROVIDER;

        try {
            if (!providerType) {
                return {
                    provider: 'Database',
                    valid: false,
                    configured: false,
                    message: 'DATABASE_PROVIDER not set',
                };
            }

            const configCheck = this.checkDatabaseConfig(providerType);
            if (!configCheck.valid) {
                return {
                    provider: 'Database',
                    valid: false,
                    configured: false,
                    message: configCheck.message,
                    details: configCheck.details,
                };
            }

            // Try to initialize
            const provider = await DatabaseFactory.createProvider(providerType as any);
            await provider.close();

            return {
                provider: `Database (${providerType})`,
                valid: true,
                configured: true,
                connected: true,
                message: 'Successfully connected',
            };
        } catch (error) {
            return {
                provider: 'Database',
                valid: false,
                configured: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Check database specific configuration
     */
    private static checkDatabaseConfig(providerType: string): {valid: boolean; message: string; details?: any} {
        const checks: Record<string, string[]> = {
            sqlite: [], // No required config for SQLite
            mysql: ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'],
            postgresql: ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DATABASE'],
        };

        const requiredVars = checks[providerType] || [];
        const missing = requiredVars.filter((v) => !process.env[v]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required environment variables: ${missing.join(', ')}`,
                details: {required: requiredVars, missing},
            };
        }

        return {valid: true, message: 'Configuration complete'};
    }

    /**
     * Validate notification provider configuration
     */
    private static async validateNotificationProvider(): Promise<ValidationResult> {
        const providerType = process.env.NOTIFICATION_PROVIDER;

        try {
            if (!providerType) {
                return {
                    provider: 'Notification',
                    valid: false,
                    configured: false,
                    message: 'NOTIFICATION_PROVIDER not set',
                };
            }

            const configCheck = this.checkNotificationConfig(providerType);
            if (!configCheck.valid) {
                return {
                    provider: 'Notification',
                    valid: false,
                    configured: false,
                    message: configCheck.message,
                    details: configCheck.details,
                };
            }

            return {
                provider: `Notification (${providerType})`,
                valid: true,
                configured: true,
                message: 'Configuration valid',
            };
        } catch (error) {
            return {
                provider: 'Notification',
                valid: false,
                configured: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Check notification provider specific configuration
     */
    private static checkNotificationConfig(providerType: string): {valid: boolean; message: string; details?: any} {
        const checks: Record<string, string[]> = {
            email: ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'],
            slack: ['SLACK_WEBHOOK_URL'],
            teams: ['TEAMS_WEBHOOK_URL'],
        };

        const requiredVars = checks[providerType] || [];
        const missing = requiredVars.filter((v) => !process.env[v]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required environment variables: ${missing.join(', ')}`,
                details: {required: requiredVars, missing},
            };
        }

        return {valid: true, message: 'Configuration complete'};
    }

    /**
     * Validate PR provider configuration
     */
    private static async validatePRProvider(): Promise<ValidationResult> {
        const providerType = process.env.PR_PROVIDER;

        try {
            if (!providerType) {
                return {
                    provider: 'PR Provider',
                    valid: false,
                    configured: false,
                    message: 'PR_PROVIDER not set',
                };
            }

            const configCheck = this.checkPRProviderConfig(providerType);
            if (!configCheck.valid) {
                return {
                    provider: 'PR Provider',
                    valid: false,
                    configured: false,
                    message: configCheck.message,
                    details: configCheck.details,
                };
            }

            return {
                provider: `PR Provider (${providerType})`,
                valid: true,
                configured: true,
                message: 'Configuration valid',
            };
        } catch (error) {
            return {
                provider: 'PR Provider',
                valid: false,
                configured: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Check PR provider specific configuration
     */
    private static checkPRProviderConfig(providerType: string): {valid: boolean; message: string; details?: any} {
        const checks: Record<string, string[]> = {
            github: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
            'azure-devops': ['AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT'],
        };

        const requiredVars = checks[providerType] || [];
        const missing = requiredVars.filter((v) => !process.env[v]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `Missing required environment variables: ${missing.join(', ')}`,
                details: {required: requiredVars, missing},
            };
        }

        return {valid: true, message: 'Configuration complete'};
    }

    /**
     * Print validation results
     */
    private static printResults(results: ValidationResult[]): void {
        console.log('\n=== Validation Results ===\n');

        let allValid = true;

        results.forEach((result) => {
            const status = result.valid ? '✓' : '✗';
            const color = result.valid ? '\x1b[32m' : '\x1b[31m';
            const reset = '\x1b[0m';

            console.log(`${color}${status} ${result.provider}${reset}`);
            console.log(`  ${result.message}`);

            if (result.connected !== undefined) {
                const connStatus = result.connected ? '✓ Connected' : '✗ Connection failed';
                console.log(`  ${connStatus}`);
            }

            if (result.details) {
                console.log(`  Details:`, result.details);
            }

            console.log('');

            if (!result.valid) {
                allValid = false;
            }
        });

        if (allValid) {
            console.log('\x1b[32m✓ All configured providers are valid!\x1b[0m\n');
        } else {
            console.log('\x1b[31m✗ Some providers have configuration issues\x1b[0m\n');
        }
    }

    /**
     * Generate a configuration report
     */
    static async generateReport(): Promise<string> {
        const results = await this.validateAll();

        let report = '# Provider Configuration Report\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;

        report += '## Configured Providers\n\n';
        results.forEach((result) => {
            report += `### ${result.provider}\n\n`;
            report += `- Status: ${result.valid ? 'Valid' : 'Invalid'}\n`;
            report += `- Configured: ${result.configured ? 'Yes' : 'No'}\n`;
            if (result.connected !== undefined) {
                report += `- Connected: ${result.connected ? 'Yes' : 'No'}\n`;
            }
            report += `- Message: ${result.message}\n`;
            if (result.details) {
                report += `- Details: \`${JSON.stringify(result.details)}\`\n`;
            }
            report += '\n';
        });

        return report;
    }
}

// CLI usage
if (require.main === module) {
    ConfigValidator.validateAll()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Validation failed:', error);
            process.exit(1);
        });
}
