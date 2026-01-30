/**
 * Factory for creating database provider instances
 */

import {IDatabaseProvider} from '../interfaces/IDatabaseProvider';
import {SQLiteProvider, SQLiteConfig} from '../databases/SQLiteProvider';
import {MySQLProvider, MySQLConfig} from '../databases/MySQLProvider';

export type DatabaseType = 'sqlite' | 'mysql' | 'postgresql';

export class DatabaseFactory {
    /**
     * Load SQLite configuration from environment variables
     */
    private static loadSQLiteConfigFromEnv() {
        return {
            databasePath: process.env.SQLITE_DATABASE_PATH || './data/test-results.db',
        };
    }

    /**
     * Load MySQL configuration from environment variables
     */
    private static loadMySQLConfigFromEnv() {
        return {
            host: process.env.MYSQL_HOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT || '3306', 10),
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'test_results',
        };
    }

    /**
     * Create a database provider based on the provider type
     * @param providerType - The type of database provider to create
     * @param config - Optional configuration for the provider
     * @returns An initialized database provider instance
     */
    static async createProvider(
        providerType: DatabaseType,
        config?: Record<string, unknown>,
    ): Promise<IDatabaseProvider> {
        let provider: IDatabaseProvider;

        switch (providerType.toLowerCase()) {
            case 'sqlite': {
                // Load config from environment if not provided
                const sqliteConfig = config || this.loadSQLiteConfigFromEnv();
                provider = new SQLiteProvider(sqliteConfig as SQLiteConfig);
                break;
            }

            case 'mysql': {
                // Load config from environment if not provided
                const mysqlConfig = config || this.loadMySQLConfigFromEnv();
                provider = new MySQLProvider(mysqlConfig as MySQLConfig);
                break;
            }

            case 'postgresql':
            case 'postgres':
                // TODO: Implement PostgreSQL provider
                throw new Error('PostgreSQL provider not yet implemented');

            default:
                throw new Error(
                    `Unknown database provider type: ${providerType}. ` + `Supported types: sqlite, mysql, postgresql`,
                );
        }

        try {
            await provider.initialize();
        } catch (error: any) {
            // Provide helpful error message for missing dependencies
            if (error.message?.includes('Failed to load SQLite dependencies')) {
                throw new Error(
                    `SQLite dependencies not available. ` +
                        `This is common in CI environments where native bindings may not compile.\n\n` +
                        `Solutions:\n` +
                        `1. Set publishToDB: false in your reporter config to disable database features\n` +
                        `2. Use a different database provider: DATABASE_PROVIDER=mysql\n` +
                        `3. Install sqlite3 with: npm install sqlite3 sqlite\n\n` +
                        `Original error: ${error.message}`,
                );
            }
            throw error;
        }

        return provider;
    }

    /**
     * Create a database provider from environment variable
     * @param envVarName - Name of the environment variable (default: DATABASE_PROVIDER)
     * @returns An initialized database provider instance
     */
    static async createFromEnv(envVarName: string = 'DATABASE_PROVIDER'): Promise<IDatabaseProvider> {
        const providerType = process.env[envVarName] || 'sqlite';
        return this.createProvider(providerType as DatabaseType);
    }
}
