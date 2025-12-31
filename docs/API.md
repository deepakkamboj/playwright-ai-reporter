# API Reference

## Core Components

### Reporter Class

The main reporter class that implements Playwright's `Reporter` interface.

```typescript
import SmartReporter from 'playwright-smart-reporter';

const reporter = new SmartReporter(options);
```

#### Options

| Option                    | Type      | Default          | Description                                           |
| ------------------------- | --------- | ---------------- | ----------------------------------------------------- |
| `slowTestThreshold`       | `number`  | `5`              | Tests slower than this (seconds) are flagged as slow  |
| `maxSlowTestsToShow`      | `number`  | `3`              | Maximum number of slow tests to display               |
| `timeoutWarningThreshold` | `number`  | `30`             | Warn if tests approach this timeout value (seconds)   |
| `showStackTrace`          | `boolean` | `true`           | Include full stack traces in error reports            |
| `outputDir`               | `string`  | `./test-results` | Directory for JSON output files                       |
| `generateFix`             | `boolean` | `false`          | Generate AI-powered fix suggestions                   |
| `createBug`               | `boolean` | `false`          | Auto-create bugs for failures                         |
| `generatePR`              | `boolean` | `false`          | Auto-create PRs with fixes                            |
| `publishToDB`             | `boolean` | `false`          | Publish test results to database                      |
| `sendEmail`               | `boolean` | `false`          | Send email notifications                              |

---

## Provider Registry

Centralized provider management using the singleton pattern.

### Initialize

```typescript
import {ProviderRegistry} from 'playwright-smart-reporter';

await ProviderRegistry.initialize({
    ai: {type: 'openai'},
    bugTracker: {type: 'github'},
    database: {type: 'sqlite'},
    notification: {type: 'email'},
    pr: {type: 'github'},
});
```

### Get Providers

```typescript
const aiProvider = await ProviderRegistry.getAIProvider();
const bugTracker = await ProviderRegistry.getBugTrackerProvider();
const database = await ProviderRegistry.getDatabaseProvider();
const notification = await ProviderRegistry.getNotificationProvider();
const prProvider = await ProviderRegistry.getPRProvider();
```

### Cleanup

```typescript
await ProviderRegistry.cleanup();
```

---

## AI Providers

### IAIProvider Interface

```typescript
interface IAIProvider {
    generateCompletion(messages: Message[]): Promise<CompletionResponse>;
}

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface CompletionResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
```

### Supported Providers

#### Azure OpenAI

```typescript
import {AzureOpenAIProvider} from 'playwright-smart-reporter';

const provider = new AzureOpenAIProvider({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiKey: process.env.AZURE_OPENAI_API_KEY, // Optional with Managed Identity
});

const response = await provider.generateCompletion([
    {role: 'system', content: 'You are a test engineer.'},
    {role: 'user', content: 'Analyze this test failure...'},
]);
```

#### OpenAI

```typescript
import {OpenAIProvider} from 'playwright-smart-reporter';

const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
});

const response = await provider.generateCompletion(messages);
```

#### Anthropic (Claude)

```typescript
import {AnthropicProvider} from 'playwright-smart-reporter';

const provider = new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
});

const response = await provider.generateCompletion(messages);
```

#### Google AI (Gemini)

```typescript
import {GoogleAIProvider} from 'playwright-smart-reporter';

const provider = new GoogleAIProvider({
    apiKey: process.env.GOOGLE_AI_API_KEY,
    model: process.env.GOOGLE_AI_MODEL || 'gemini-pro',
});

const response = await provider.generateCompletion(messages);
```

#### Mistral AI

```typescript
import {MistralProvider} from 'playwright-smart-reporter';

const provider = new MistralProvider({
    apiKey: process.env.MISTRAL_API_KEY,
    model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
});

const response = await provider.generateCompletion(messages);
```

---

## Bug Tracker Providers

### IBugTrackerProvider Interface

```typescript
interface IBugTrackerProvider {
    createBug(bug: BugDetails): Promise<BugResponse>;
}

interface BugDetails {
    title: string;
    description: string;
    labels?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignee?: string;
    metadata?: Record<string, any>;
}

interface BugResponse {
    id: string;
    url: string;
    number?: number;
}
```

### Supported Providers

#### GitHub Issues

```typescript
import {GitHubBugTracker} from 'playwright-smart-reporter';

const bugTracker = new GitHubBugTracker({
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
});

const bug = await bugTracker.createBug({
    title: 'Test failure: Login test',
    description: 'Test failed with timeout error...',
    labels: ['test-failure', 'bug'],
    priority: 'high',
});
```

#### Azure DevOps

```typescript
import {AzureDevOpsBugTracker} from 'playwright-smart-reporter';

const bugTracker = new AzureDevOpsBugTracker({
    orgUrl: process.env.AZURE_DEVOPS_ORG_URL,
    project: process.env.AZURE_DEVOPS_PROJECT,
    pat: process.env.AZURE_DEVOPS_PAT,
});

const bug = await bugTracker.createBug(bugDetails);
```

#### Jira

```typescript
import {JiraBugTracker} from 'playwright-smart-reporter';

const bugTracker = new JiraBugTracker({
    host: process.env.JIRA_HOST,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
    projectKey: process.env.JIRA_PROJECT_KEY,
});

const bug = await bugTracker.createBug(bugDetails);
```

---

## Database Providers

### IDatabaseProvider Interface

```typescript
interface IDatabaseProvider {
    saveTestRun(run: TestRun): Promise<string>;
    saveTestResult(result: TestResult): Promise<void>;
    query(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
}

interface TestRun {
    name: string;
    timestamp: Date;
    environment: string;
    branch?: string;
    commit?: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
}

interface TestResult {
    testRunId: string;
    testId: string;
    title: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    retries: number;
}
```

### Supported Providers

#### SQLite

```typescript
import {SQLiteProvider} from 'playwright-smart-reporter';

const db = new SQLiteProvider({
    dbPath: process.env.SQLITE_DB_PATH || './test-results.db',
});

const runId = await db.saveTestRun(testRun);
await db.saveTestResult(testResult);

const results = await db.query('SELECT * FROM test_results WHERE status = ?', ['failed']);
```

#### MySQL

```typescript
import {MySQLProvider} from 'playwright-smart-reporter';

const db = new MySQLProvider({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

const runId = await db.saveTestRun(testRun);
await db.saveTestResult(testResult);
```

---

## PR Providers

### IPRProvider Interface

```typescript
interface IPRProvider {
    createPR(pr: PRDetails): Promise<PRResponse>;
}

interface PRDetails {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    labels?: string[];
    isDraft?: boolean;
}

interface PRResponse {
    id: string;
    url: string;
    number?: number;
}
```

### Supported Providers

#### GitHub PRs

```typescript
import {GitHubPRProvider} from 'playwright-smart-reporter';

const prProvider = new GitHubPRProvider({
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
});

const pr = await prProvider.createPR({
    title: 'Auto-fix: Login test timeout',
    description: 'AI-generated fix for test failure...',
    sourceBranch: 'autofix/login-test-123',
    targetBranch: 'main',
    labels: ['auto-fix', 'test-failure'],
    isDraft: true,
});
```

#### Azure DevOps PRs

```typescript
import {AzureDevOpsPRProvider} from 'playwright-smart-reporter';

const prProvider = new AzureDevOpsPRProvider({
    orgUrl: process.env.AZURE_DEVOPS_ORG_URL,
    project: process.env.AZURE_DEVOPS_PROJECT,
    repository: process.env.AZURE_DEVOPS_REPO,
    pat: process.env.AZURE_DEVOPS_PAT,
});

const pr = await prProvider.createPR(prDetails);
```

---

## Notification Providers

### INotificationProvider Interface

```typescript
interface INotificationProvider {
    send(notification: NotificationDetails): Promise<void>;
}

interface NotificationDetails {
    subject: string;
    body: string;
    recipients: string[];
    priority?: 'low' | 'normal' | 'high';
}
```

### Supported Providers

#### Email (SMTP)

```typescript
import {EmailNotificationProvider} from 'playwright-smart-reporter';

const notifier = new EmailNotificationProvider({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
});

await notifier.send({
    subject: 'Test Failure Alert',
    body: 'Tests failed in CI pipeline...',
    recipients: ['team@example.com'],
    priority: 'high',
});
```

---

## Utility Functions

### GenAI Utils

```typescript
import {GenAIUtils} from 'playwright-smart-reporter';

// Generate fix suggestion
const fix = await GenAIUtils.generateFixSuggestion({
    testName: 'Login test',
    error: 'Timeout waiting for selector',
    testCode: '...',
    stackTrace: '...',
});

// Save fix to file
await GenAIUtils.saveFixToFile(fix, './test-results/fixes/');
```

### History Utils

```typescript
import {HistoryUtils} from 'playwright-smart-reporter';

// Check if test was failing previously
const wasFailing = HistoryUtils.wasTestFailingPreviously('test-id-123');

// Compare with previous run
const {newlyFailing, fixed} = HistoryUtils.compareWithPreviousRun([
    'test-id-1',
    'test-id-2',
]);
```

### Build Info Utils

```typescript
import {BuildInfoUtils} from 'playwright-smart-reporter';

// Detect CI environment
const buildInfo = BuildInfoUtils.detectCI();

console.log(buildInfo);
// {
//   isCI: true,
//   ciSystem: 'GitHub Actions',
//   buildNumber: '1234',
//   branch: 'main',
//   commit: 'abc123',
//   buildUrl: 'https://github.com/...',
// }
```

### File Handler Utils

```typescript
import {FileHandlerUtils} from 'playwright-smart-reporter';

// Save test summary
await FileHandlerUtils.saveSummary(summary, './test-results/');

// Save failures
await FileHandlerUtils.saveFailures(failures, './test-results/');

// Read previous run
const previousRun = await FileHandlerUtils.readPreviousRun('./test-results/');
```

---

## Factories

### AIProviderFactory

```typescript
import {AIProviderFactory} from 'playwright-smart-reporter';

const provider = await AIProviderFactory.createProvider('openai');
const response = await provider.generateCompletion(messages);
```

### BugTrackerFactory

```typescript
import {BugTrackerFactory} from 'playwright-smart-reporter';

const bugTracker = await BugTrackerFactory.createProvider('github');
const bug = await bugTracker.createBug(bugDetails);
```

### DatabaseFactory

```typescript
import {DatabaseFactory} from 'playwright-smart-reporter';

const db = await DatabaseFactory.createProvider('sqlite');
const runId = await db.saveTestRun(testRun);
```

### NotificationFactory

```typescript
import {NotificationFactory} from 'playwright-smart-reporter';

const notifier = await NotificationFactory.createProvider('email');
await notifier.send(notification);
```

### PRProviderFactory

```typescript
import {PRProviderFactory} from 'playwright-smart-reporter';

const prProvider = await PRProviderFactory.createProvider('github');
const pr = await prProvider.createPR(prDetails);
```

---

## Type Definitions

All TypeScript type definitions are exported from the main package:

```typescript
import type {
    IAIProvider,
    IBugTrackerProvider,
    IDatabaseProvider,
    INotificationProvider,
    IPRProvider,
    Message,
    CompletionResponse,
    BugDetails,
    BugResponse,
    TestRun,
    TestResult,
    PRDetails,
    PRResponse,
    NotificationDetails,
} from 'playwright-smart-reporter';
```

---

## Error Handling

All provider methods can throw errors. Wrap calls in try-catch blocks:

```typescript
try {
    const provider = await AIProviderFactory.createProvider('openai');
    const response = await provider.generateCompletion(messages);
} catch (error) {
    console.error('Failed to generate AI completion:', error);
    // Handle error appropriately
}
```

---

## Best Practices

1. **Always validate configuration** before running tests
2. **Use environment variables** for sensitive data (API keys, tokens)
3. **Review AI-generated fixes** before applying them
4. **Enable draft PRs** to ensure code review
5. **Store test history** in a database for trend analysis
6. **Use appropriate AI models** based on cost and quality requirements
7. **Clean up resources** by calling `ProviderRegistry.cleanup()`

---

For more examples, see the [examples](../examples/) folder.
