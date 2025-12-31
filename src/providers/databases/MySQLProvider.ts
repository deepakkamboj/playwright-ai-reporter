/**
 * MySQL Database Provider
 */

import mysql from 'mysql2/promise';
import {IDatabaseProvider, TestRun, TestResult} from '../interfaces/IDatabaseProvider';

export interface MySQLConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
}

export class MySQLProvider implements IDatabaseProvider {
    private connection: mysql.Connection | null = null;
    private config: MySQLConfig;

    constructor(config: MySQLConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            this.connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port || 3306,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
            });

            await this.createTables();
            console.log('MySQL database initialized successfully');
        } catch (error) {
            console.error('Error initializing MySQL database:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            console.log('MySQL database connection closed');
        }
    }

    async saveTestRun(testRun: TestRun): Promise<string> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [result] = await this.connection.execute(
                `INSERT INTO test_runs (name, timestamp, environment, branch, commit_hash, total_tests, passed_tests, failed_tests, skipped_tests, duration, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    testRun.name,
                    testRun.timestamp,
                    testRun.environment,
                    testRun.branch,
                    testRun.commitHash,
                    testRun.totalTests,
                    testRun.passedTests,
                    testRun.failedTests,
                    testRun.skippedTests,
                    testRun.duration,
                    testRun.metadata ? JSON.stringify(testRun.metadata) : null,
                ],
            );

            const runId = (result as any).insertId.toString();
            console.log(`Saved test run with ID: ${runId}`);
            return runId;
        } catch (error) {
            console.error('Error saving test run:', error);
            throw error;
        }
    }

    async saveTestResults(testRunId: string, results: TestResult[]): Promise<number> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const values = results.map((result) => [
                testRunId,
                result.testId,
                result.testTitle,
                result.suiteTitle,
                result.status,
                result.duration,
                result.errorMessage,
                result.errorStack,
                result.retries,
                result.timestamp,
                result.metadata ? JSON.stringify(result.metadata) : null,
            ]);

            await this.connection.query(
                `INSERT INTO test_results (test_run_id, test_id, test_title, suite_title, status, duration, error_message, error_stack, retries, timestamp, metadata)
                VALUES ?`,
                [values],
            );

            console.log(`Saved ${results.length} test results for run ${testRunId}`);
            return results.length;
        } catch (error) {
            console.error('Error saving test results:', error);
            throw error;
        }
    }

    async saveTestResult(result: TestResult): Promise<string> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [insertResult] = await this.connection.execute(
                `INSERT INTO test_results (test_run_id, test_id, test_title, suite_title, status, duration, error_message, error_stack, retries, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.testRunId,
                    result.testId,
                    result.testTitle,
                    result.suiteTitle,
                    result.status,
                    result.duration,
                    result.errorMessage,
                    result.errorStack,
                    result.retries,
                    result.timestamp,
                    result.metadata ? JSON.stringify(result.metadata) : null,
                ],
            );

            const resultId = (insertResult as any).insertId.toString();
            console.log(`Saved test result with ID: ${resultId}`);
            return resultId;
        } catch (error) {
            console.error('Error saving test result:', error);
            throw error;
        }
    }

    async getTestRun(testRunId: string): Promise<TestRun | null> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [rows] = await this.connection.execute('SELECT * FROM test_runs WHERE id = ?', [testRunId]);

            const rowArray = rows as any[];
            if (rowArray.length === 0) {
                return null;
            }

            return this.mapRowToTestRun(rowArray[0]);
        } catch (error) {
            console.error('Error getting test run:', error);
            throw error;
        }
    }

    async getTestResults(testRunId: string): Promise<TestResult[]> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [rows] = await this.connection.execute(
                'SELECT * FROM test_results WHERE test_run_id = ? ORDER BY timestamp',
                [testRunId],
            );

            return (rows as any[]).map((row) => this.mapRowToTestResult(row));
        } catch (error) {
            console.error('Error getting test results:', error);
            throw error;
        }
    }

    async getTestRunHistory(limit: number = 50, offset: number = 0): Promise<TestRun[]> {
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [rows] = await this.connection.execute(
                'SELECT * FROM test_runs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
                [limit, offset],
            );

            return (rows as any[]).map((row) => this.mapRowToTestRun(row));
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
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        try {
            const [rows] = await this.connection.execute(
                `SELECT status FROM test_results 
                WHERE test_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?`,
                [testId, limit],
            );

            const rowArray = rows as any[];
            const totalRuns = rowArray.length;
            const failures = rowArray.filter((row) => row.status === 'failed').length;
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
        if (!this.connection) {
            throw new Error('Database not initialized');
        }

        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS test_runs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                timestamp DATETIME NOT NULL,
                environment VARCHAR(100),
                branch VARCHAR(255),
                commit_hash VARCHAR(255),
                total_tests INT NOT NULL,
                passed_tests INT NOT NULL,
                failed_tests INT NOT NULL,
                skipped_tests INT NOT NULL,
                duration FLOAT NOT NULL,
                metadata JSON,
                INDEX idx_timestamp (timestamp)
            )
        `);

        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS test_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                test_run_id INT NOT NULL,
                test_id VARCHAR(255) NOT NULL,
                test_title VARCHAR(500) NOT NULL,
                suite_title VARCHAR(500) NOT NULL,
                status VARCHAR(50) NOT NULL,
                duration FLOAT NOT NULL,
                error_message TEXT,
                error_stack TEXT,
                retries INT,
                timestamp DATETIME NOT NULL,
                metadata JSON,
                FOREIGN KEY (test_run_id) REFERENCES test_runs(id),
                INDEX idx_test_run_id (test_run_id),
                INDEX idx_test_id (test_id),
                INDEX idx_status (status)
            )
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
            metadata: row.metadata
                ? typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata
                : undefined,
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
            metadata: row.metadata
                ? typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata
                : undefined,
        };
    }
}
