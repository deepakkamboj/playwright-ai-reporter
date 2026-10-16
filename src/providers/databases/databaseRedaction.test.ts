import assert from 'node:assert/strict';
import test from 'node:test';
import {TestResult} from '../interfaces/IDatabaseProvider';
import {MySQLProvider} from './MySQLProvider';
import {SQLiteProvider} from './SQLiteProvider';

const result = (secret: string): TestResult => ({
    testRunId: 'run-1',
    testId: 'test-1',
    testTitle: `failure repeated ${secret}`,
    suiteTitle: 'suite',
    status: 'failed',
    duration: 1,
    errorMessage: `password=${secret}`,
    errorStack: `Bearer ${secret}`,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {apiKey: secret, repeated: secret},
});

test('MySQL parameters are redacted before execution', async () => {
    const calls: unknown[][] = [];
    const provider = new MySQLProvider({host: 'localhost', user: 'user', password: 'pass', database: 'tests'});
    (provider as unknown as {connection: {execute: (...args: unknown[]) => Promise<unknown[]>}}).connection = {
        execute: async (...args) => {
            calls.push(args);
            return [{insertId: 1}];
        },
    };
    const secret = 'mysql-secret-123456789';

    await provider.saveTestResult(result(secret));

    assert.doesNotMatch(JSON.stringify(calls), new RegExp(secret));
    assert.match(JSON.stringify(calls), /\*\*\*\*/);
});

test('SQLite parameters are redacted before execution', async () => {
    const calls: unknown[][] = [];
    const provider = new SQLiteProvider({databasePath: ':memory:'});
    (provider as unknown as {db: {run: (...args: unknown[]) => Promise<{lastID: number}>}}).db = {
        run: async (...args) => {
            calls.push(args);
            return {lastID: 1};
        },
    };
    const secret = 'sqlite-secret-123456789';

    await provider.saveTestResult(result(secret));

    assert.doesNotMatch(JSON.stringify(calls), new RegExp(secret));
    assert.match(JSON.stringify(calls), /\*\*\*\*/);
});
