/**
 * SQLite Database Provider
 */

import {IDatabaseProvider, TestRun, TestResult} from '../interfaces/IDatabaseProvider';
import * as path from 'path';
import * as fs from 'fs';

export interface SQLiteConfig {
    databasePath: string;
}

// Type definitions for lazy-loaded modules
type Sqlite3Module = typeof import('sqlite3');
type SqliteModule = typeof import('sqlite');
type Database = import('sqlite').Database<import('sqlite3').Database, import('sqlite3').Statement>;

export class SQLiteProvider implements IDatabaseProvider {
    private db: Database | null = null;
    private config: SQLiteConfig;
    private sqlite3?: Sqlite3Module;
    private sqlite?: SqliteModule;

    constructor(config: SQLiteConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            // Lazy load sqlite3 and sqlite modules
            try {
                this.sqlite3 = await import('sqlite3');
                this.sqlite = await import('sqlite');
            } catch (importError: any) {
                throw new Error(
                    `Failed to load SQLite dependencies. ` +
                        `Please install them with: npm install sqlite3 sqlite\n` +
                        `Original error: ${importError.message}\n\n` +
                        `If you're experiencing native binding issues in CI, consider:\n` +
                        `1. Setting publishToDB: false to disable database features\n` +
                        `2. Using a different DATABASE_PROVIDER (e.g., mysql)\n` +
                        `3. Installing better-sqlite3 instead (future support coming)`,
                );
            }

            // Ensure directory exists
            const dbDir = path.dirname(this.config.databasePath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, {recursive: true});
                console.log(`Created database directory: ${dbDir}`);
            }

            this.db = await this.sqlite.open({
                filename: this.config.databasePath,
                driver: this.sqlite3.Database,
            });

            await this.createTables();
            console.log('SQLite database initialized successfully');
        } catch (error) {
            console.error('Error initializing SQLite database:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('SQLite database connection closed');
        }
    }

    async saveTestRun(testRun: TestRun): Promise<string> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const result = await this.db.run(
                `INSERT INTO test_runs (name, timestamp, environment, branch, commit_hash, total_tests, passed_tests, failed_tests, skipped_tests, duration, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                testRun.name,
                testRun.timestamp.toISOString(),
                testRun.environment,
                testRun.branch,
                testRun.commitHash,
                testRun.totalTests,
                testRun.passedTests,
                testRun.failedTests,
                testRun.skippedTests,
                testRun.duration,
                testRun.metadata ? JSON.stringify(testRun.metadata) : null,
            );

            const runId = result.lastID!.toString();
            console.log(`Saved test run with ID: ${runId}`);
            return runId;
        } catch (error) {
            console.error('Error saving test run:', error);
            throw error;
        }
    }

    async saveTestResults(testRunId: string, results: TestResult[]): Promise<number> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const stmt = await this.db.prepare(
                `INSERT INTO test_results (test_run_id, test_id, test_title, suite_title, status, duration, error_message, error_stack, retries, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            );

            let savedCount = 0;
            for (const result of results) {
                await stmt.run(
                    testRunId,
                    result.testId,
                    result.testTitle,
                    result.suiteTitle,
                    result.status,
                    result.duration,
                    result.errorMessage,
                    result.errorStack,
                    result.retries,
                    result.timestamp.toISOString(),
                    result.metadata ? JSON.stringify(result.metadata) : null,
                );
                savedCount++;
            }

            await stmt.finalize();
            console.log(`Saved ${savedCount} test results for run ${testRunId}`);
            return savedCount;
        } catch (error) {
            console.error('Error saving test results:', error);
            throw error;
        }
    }

    async saveTestResult(result: TestResult): Promise<string> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const insertResult = await this.db.run(
                `INSERT INTO test_results (test_run_id, test_id, test_title, suite_title, status, duration, error_message, error_stack, retries, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                result.testRunId,
                result.testId,
                result.testTitle,
                result.suiteTitle,
                result.status,
                result.duration,
                result.errorMessage,
                result.errorStack,
                result.retries,
                result.timestamp.toISOString(),
                result.metadata ? JSON.stringify(result.metadata) : null,
            );

            const resultId = insertResult.lastID!.toString();
            console.log(`Saved test result with ID: ${resultId}`);
            return resultId;
        } catch (error) {
            console.error('Error saving test result:', error);
            throw error;
        }
    }

    async getTestRun(testRunId: string): Promise<TestRun | null> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const row = await this.db.get('SELECT * FROM test_runs WHERE id = ?', testRunId);

            if (!row) {
                return null;
            }

            return this.mapRowToTestRun(row);
        } catch (error) {
            console.error('Error getting test run:', error);
            throw error;
        }
    }

    async getTestResults(testRunId: string): Promise<TestResult[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const rows = await this.db.all(
                'SELECT * FROM test_results WHERE test_run_id = ? ORDER BY timestamp',
                testRunId,
            );

            return rows.map((row) => this.mapRowToTestResult(row));
        } catch (error) {
            console.error('Error getting test results:', error);
            throw error;
        }
    }

    async getTestRunHistory(limit: number = 50, offset: number = 0): Promise<TestRun[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const rows = await this.db.all(
                'SELECT * FROM test_runs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
                limit,
                offset,
            );

            return rows.map((row) => this.mapRowToTestRun(row));
        } catch (error) {
            console.error('Error getting test run history:', error);
            throw error;
        }
    }

    async getTestFailureTrends(
        testId: string,
        limit: number = 10,
    ): Promise<{
        totalRuns: number;
        failures: number;
        successRate: number;
    }> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const rows = await this.db.all(
                `SELECT status FROM test_results 
                WHERE test_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?`,
                testId,
                limit,
            );

            const totalRuns = rows.length;
            const failures = rows.filter((row) => row.status === 'failed').length;
            const successRate = totalRuns > 0 ? ((totalRuns - failures) / totalRuns) * 100 : 0;

            return {
                totalRuns,
                failures,
                successRate,
            };
        } catch (error) {
            console.error('Error getting test failure trends:', error);
            throw error;
        }
    }

    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS test_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                environment TEXT,
                branch TEXT,
                commit_hash TEXT,
                total_tests INTEGER NOT NULL,
                passed_tests INTEGER NOT NULL,
                failed_tests INTEGER NOT NULL,
                skipped_tests INTEGER NOT NULL,
                duration REAL NOT NULL,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS test_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                test_id TEXT NOT NULL,
                test_title TEXT NOT NULL,
                suite_title TEXT NOT NULL,
                status TEXT NOT NULL,
                duration REAL NOT NULL,
                error_message TEXT,
                error_stack TEXT,
                retries INTEGER,
                timestamp TEXT NOT NULL,
                metadata TEXT,
                FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
            );

            CREATE INDEX IF NOT EXISTS idx_test_run_timestamp ON test_runs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(test_run_id);
            CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
            CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
        `);
    }

    private mapRowToTestRun(row: any): TestRun {
        return {
            id: row.id.toString(),
            name: row.name,
            timestamp: new Date(row.timestamp),
            environment: row.environment,
            branch: row.branch,
            commitHash: row.commit_hash,
            totalTests: row.total_tests,
            passedTests: row.passed_tests,
            failedTests: row.failed_tests,
            skippedTests: row.skipped_tests,
            duration: row.duration,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }

    private mapRowToTestResult(row: any): TestResult {
        return {
            id: row.id.toString(),
            testRunId: row.test_run_id.toString(),
            testId: row.test_id,
            testTitle: row.test_title,
            suiteTitle: row.suite_title,
            status: row.status,
            duration: row.duration,
            errorMessage: row.error_message,
            errorStack: row.error_stack,
            retries: row.retries,
            timestamp: new Date(row.timestamp),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }
}
