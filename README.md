<div align="center">
  <img src="docs/logo.png" alt="Playwright AI Reporter Logo" width="400" />
  
  <h1><strong>Playwright AI Reporter</strong></h1>

[![Build Status](https://github.com/deepakkamboj/playwright-ai-reporter/actions/workflows/ci.yml/badge.svg)](https://github.com/deepakkamboj/playwright-ai-reporter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/playwright-ai-reporter.svg)](https://www.npmjs.com/package/playwright-ai-reporter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%2B-blue)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.51%2B-green)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org/)

  <p><strong>Transform test failures into actionable insights with AI-powered analysis and auto-healing</strong></p>
</div>

**Playwright AI Reporter** is an enterprise-grade, production-ready test reporter that combines artificial intelligence with comprehensive test automation workflows. Built on a flexible provider-based architecture, it automatically analyzes test failures, creates detailed bug reports, generates fix suggestions, and can even submit auto-healing pull requests—all while integrating seamlessly with your existing development tools.

### 🎯 **Why Choose Playwright AI Reporter?**

- **🧠 AI-Powered Analysis** - Multiple AI providers (Azure OpenAI, Anthropic Claude, Google Gemini, Mistral, OpenAI) analyze failures and suggest intelligent fixes
- **🔌 Plug & Play Architecture** - Swap bug trackers, databases, AI providers, and notification systems without code changes
- **🚀 Auto-Healing Tests** - Automatically generate and submit PRs with AI-suggested fixes for flaky or failing tests
- **📊 Enterprise Integration** - Native support for GitHub, Azure DevOps, Jira, MySQL, SQLite, SMTP, and more
- **🎨 Rich Reporting** - Colorized console output, comprehensive metrics, historical analysis, and build integration
- **⚡ Production-Ready** - TypeScript, fully tested, extensive documentation, CI/CD workflows included

> 💡 **Perfect for** - CI/CD pipelines • Enterprise test automation • Multi-team projects • Flaky test management • Test debugging at scale

---

## **📖 Table of Contents**

- [Features](#-features)
- [What's New](#-whats-new)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Provider Support](#-provider-support)
- [Usage Examples](#-usage-examples)
- [Output Examples](#-output-examples)
- [FAQs](#-frequently-asked-questions-faqs)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## **🆕 What's New**

The latest reporter updates add an end-to-end workflow for standalone reports, Playwright shards,
direct API tests, secure evidence handling, and project onboarding:

| Capability | What was added |
| ---------- | -------------- |
| **Independent HTML report** | Test data, CSS, and JavaScript are embedded into one `test-health-report.html`. Generation fails if required data or inline assets are missing, or if external CSS/JavaScript references remain. |
| **Shard merge CLI** | `playwright-ai-reporter merge` validates versioned shard data, accepts legacy unversioned reports, combines tests and evidence deterministically, renumbers worker lanes, and writes one atomic merged report. |
| **Direct API evidence** | The opt-in `apiRequestRecorderFixture` and `recordApiRequest()` wrapper capture Playwright `APIRequestContext` calls without modifying Playwright prototypes. |
| **Comment metadata** | `commentMetadata: true` reads custom `@key value` tags from the adjacent JSDoc block. Explicit metadata attached with `meta()` remains authoritative. |
| **Onboarding CLI** | `init`, `doctor`, and `snippets` generate safe starter files, diagnose the local setup without authenticating, and install reusable VS Code snippets. |
| **Global secret redaction** | Reports, history, API evidence, AI traffic, issues, pull requests, notifications, databases, diagnostics, and logs use the same redaction boundary. |
| **More CI examples** | Complete examples cover GitHub Actions shard matrices, GitLab CI, Jenkins, and Azure Pipelines, including merged standalone-report publication. |

The generated standalone HTML can be downloaded from a pipeline and opened directly from disk. It
does not require a web server, CDN, adjacent stylesheet, or adjacent JavaScript bundle.

---

## **✨ Features**

### 🎨 **Smart Reporting & Visualization**

- ✅ Colorized console output (Passed, Failed, Retries, Skipped)
- 📊 Comprehensive test metrics and statistics
- 🎯 Slowest test identification and ranking
- ⏱️ Average test duration analysis
- 📈 Test history tracking and comparison
- 🏗️ CI/CD integration with build information
- 🌐 **Interactive HTML Report**: One self-contained file (no CDN, no server) with Overview, Tests, Failures, API and Timeline tabs, failure clusters, a priority/owner/feature breakdown, run trend and eight themes (see [HTML Test Health Report](#html-test-health-report))
- 🔁 **Flaky vs broken**: Retries plus a run history decide whether a failing test is flaky, a new failure or a known one, with the evidence and a safe next step
- 🏷️ **Test metadata**: `meta({priority, severity, owner, feature})` or opt-in adjacent JSDoc tags rank failures, group them by owner and fill the bug report
- 📡 **API recorder**: `recordApi(page)` and the opt-in `APIRequestContext` fixture show browser and direct API calls of a failing test, with secrets masked
- 📦 **CI-ready**: Publish the report as its own artifact; the Markdown summary lands on the GitHub job page or Azure Pipelines build page
- 🧩 **Shard merge CLI**: Combine matrix/shard outputs into one validated report with copied evidence and unique worker lanes
- 🩺 **Onboarding CLI**: Generate typed starter files and snippets, then diagnose Node.js, Playwright, browser, report assets, output access, and selected provider variables
- 🔐 **Defense-in-depth redaction**: Apply one secret-masking boundary to generated artifacts and outbound provider integrations

### 🤖 **AI-Powered Intelligence**

- 🧠 **Multi-AI Provider Support**: GitHub Copilot, Azure OpenAI, OpenAI, Anthropic (Claude), Google AI (Gemini), Mistral AI
- 🔑 **No Stored Model Key in GitHub Actions**: `AI_PROVIDER=copilot` uses the workflow `GITHUB_TOKEN`
- 🔧 **Automatic Fix Suggestions**: AI analyzes failures and suggests fixes
- 📝 **Context-Aware Analysis**: Includes test code, error details, and stack traces
- 🎓 **Smart Categorization**: Automatic error categorization (Timeout, Selector, Network, etc.)
- 💡 **Best Practices**: Suggestions follow Playwright best practices

### 🐛 **Automated Bug Management**

- 🎫 **Multi-Platform Bug Creation**: GitHub Issues, Azure DevOps Work Items, Jira Tickets
- 📋 **Rich Bug Details**: Test info, error details, AI suggestions, environment data
- 🏷️ **Smart Labeling**: Automatic labels and priority assignment
- 🔗 **Integrated Tracking**: Links bugs to test runs and failures

### 🔄 **Auto-Healing & PR Generation**

- 🚀 **Automatic PR Creation**: Generate PRs with AI-suggested fixes (set `generatePR: true`)
- 🌿 **Branch Management**: Auto-create topic branches (`autofix/test-name-timestamp`)
- 💾 **Smart Commits**: Commit fixes to topic branch with detailed messages
- 📤 **Push & PR**: Push changes and create pull request from topic to base branch
- 📝 **Rich PR Descriptions**: Include error analysis, test details, and fix rationale
- 🎯 **Draft PRs**: Created as drafts for mandatory code review
- 🏷️ **Auto Labels**: `auto-fix`, `test-failure`, `ai-generated` labels
- ⚙️ **Platform Support**: GitHub and Azure DevOps

### 💾 **Database & Analytics**

- 📊 **Test Run Tracking**: Store complete test run metadata (environment, branch, commit, totals, duration)
- 📈 **Result History**: Track individual test results over time with full details
- 🔍 **Failure Analysis**: Query and analyze failure patterns with indexed searches
- 🏗️ **Build Integration**: Link results to CI/CD builds with metadata
- 💾 **Multi-Database**: SQLite (file-based), MySQL, PostgreSQL support
- 🗃️ **Schema**: 2 tables (`test_runs`, `test_results`) with 4 performance indexes

---

## **🏗️ Architecture**

### **System Overview**

```mermaid
graph TB
    subgraph "Playwright Test Runner"
        Tests[Test Execution]
    end

    subgraph "AI Test Reporter"
        Reporter[Reporter Core]
        Registry[Provider Registry]
        Workflow[Test Workflow Engine]
    end

    subgraph "AI Providers"
        Azure[Azure OpenAI]
        OpenAI[OpenAI]
        Anthropic[Anthropic Claude]
        Google[Google Gemini]
        Mistral[Mistral AI]
    end

    subgraph "Bug Trackers"
        GitHub[GitHub Issues]
        ADO[Azure DevOps]
        Jira[Jira]
    end

    subgraph "Databases"
        SQLite[SQLite]
        MySQL[MySQL]
        Postgres[PostgreSQL]
    end

    subgraph "Notifications"
        Email[Email/SMTP]
        Slack[Slack]
        Teams[MS Teams]
    end

    subgraph "PR Providers"
        GHPR[GitHub PRs]
        ADOPR[Azure Repos PRs]
    end

    Tests --> Reporter
    Reporter --> Registry
    Registry --> Workflow

    Workflow --> Azure
    Workflow --> OpenAI
    Workflow --> Anthropic
    Workflow --> Google
    Workflow --> Mistral

    Workflow --> GitHub
    Workflow --> ADO
    Workflow --> Jira

    Workflow --> SQLite
    Workflow --> MySQL
    Workflow --> Postgres

    Workflow --> Email
    Workflow --> Slack
    Workflow --> Teams

    Workflow --> GHPR
    Workflow --> ADOPR

    style Reporter fill:#4CAF50
    style Registry fill:#2196F3
    style Workflow fill:#FF9800
```

### **Provider Architecture**

The reporter uses a **provider-based architecture** for maximum flexibility:

```mermaid
graph LR
    subgraph "Application Layer"
        Reporter[Test Reporter]
        Utils[Utilities]
    end

    subgraph "Provider Registry"
        Registry[Provider Registry<br/>Singleton Manager]
    end

    subgraph "Factory Layer"
        AIFactory[AI Factory]
        BugFactory[Bug Tracker Factory]
        DBFactory[Database Factory]
        NotifyFactory[Notification Factory]
        PRFactory[PR Factory]
    end

    subgraph "Provider Interfaces"
        IAI[IAIProvider]
        IBug[IBugTrackerProvider]
        IDB[IDatabaseProvider]
        INotify[INotificationProvider]
        IPR[IPRProvider]
    end

    subgraph "Concrete Implementations"
        AzureAI[Azure OpenAI]
        OpenAI[OpenAI]
        GitHubBug[GitHub Issues]
        SQLite[SQLite]
        EmailNotify[Email]
        GitHubPR[GitHub PRs]
    end

    Reporter --> Registry
    Utils --> Registry

    Registry --> AIFactory
    Registry --> BugFactory
    Registry --> DBFactory
    Registry --> NotifyFactory
    Registry --> PRFactory

    AIFactory --> IAI
    BugFactory --> IBug
    DBFactory --> IDB
    NotifyFactory --> INotify
    PRFactory --> IPR

    IAI --> AzureAI
    IAI --> OpenAI
    IBug --> GitHubBug
    IDB --> SQLite
    INotify --> EmailNotify
    IPR --> GitHubPR

    style Registry fill:#FF6B6B
    style IAI fill:#4ECDC4
    style IBug fill:#4ECDC4
    style IDB fill:#4ECDC4
    style INotify fill:#4ECDC4
    style IPR fill:#4ECDC4
```

### **Test Failure Workflow**

```mermaid
sequenceDiagram
    participant PT as Playwright Test
    participant R as Reporter
    participant AI as AI Provider
    participant BT as Bug Tracker
    participant PR as PR Provider
    participant DB as Database
    participant N as Notification

    PT->>R: Test Failed
    R->>R: Categorize Error
    R->>R: Extract Test Code

    R->>AI: Generate Fix Suggestion
    AI-->>R: AI Analysis & Fix

    par Parallel Operations
        R->>BT: Create Bug/Issue
        BT-->>R: Bug Created
    and
        R->>DB: Save Test Result
        DB-->>R: Result Saved
    end

    alt Auto-Healing Enabled
        R->>PR: Create Fix PR
        PR-->>R: PR Created
    end

    R->>N: Send Notification
    N-->>R: Notification Sent

    R->>PT: Report Complete
```

### **Core Components**

| Component             | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| **Reporter**          | Main entry point implementing Playwright's Reporter interface |
| **Provider Registry** | Centralized provider management with lazy initialization      |
| **AI Providers**      | Multiple AI service implementations for fix suggestions       |
| **Bug Trackers**      | Issue/ticket creation across platforms                        |
| **Databases**         | Test result storage and historical analysis                   |
| **PR Providers**      | Automated pull request creation                               |
| **Notifications**     | Alert delivery across channels                                |
| **Factories**         | Provider instantiation with configuration                     |
| **Workflow Engine**   | Orchestrates the test failure handling process                |

### **Design Principles**

- 🔌 **Provider Independence** - Not locked into any single service
- 🏭 **Factory Pattern** - Clean, standardized provider creation
- ⚡ **Lazy Initialization** - Resources loaded only when needed
- 🛡️ **Type Safety** - Full TypeScript support
- 🧪 **Testable** - Easy mocking for unit tests
- 📦 **Modular** - Import only what you need

---

## **⚡ Quick Start**

### **Prerequisites**

- Node.js 22 or higher
- Playwright 1.51 or higher
- An AI provider API key (Azure OpenAI, OpenAI, Anthropic, Google AI, or Mistral)

### **1. Installation**

```bash
# Install the reporter
npm install playwright-ai-reporter --save-dev

# Install optional peer dependencies based on your needs
npm install @azure/identity        # For Azure OpenAI with Managed Identity
npm install @octokit/rest          # For GitHub integration
npm install azure-devops-node-api  # For Azure DevOps integration
npm install mysql2                 # For MySQL database
npm install nodemailer            # For email notifications
```

### **2. Choose a Configuration Stack**

Copy one of the pre-configured environment files from the examples:

```bash
# GitHub + Mistral AI + SQLite
cp examples/env-configs/.env.github-stack .env

# OR Azure DevOps + Azure OpenAI + MySQL
cp examples/env-configs/.env.azure-stack .env

# OR Jira + OpenAI + SQLite
cp examples/env-configs/.env.openai-jira .env

# OR Claude AI only (minimal setup)
cp examples/env-configs/.env.anthropic-minimal .env
```

### **3. Configure Your Credentials**

Edit your `.env` file with your API keys and settings:

```env
# AI Provider (choose one)
AI_PROVIDER=mistral
MISTRAL_API_KEY=your-api-key-here

# Bug Tracker (optional)
BUG_TRACKER_PROVIDER=github
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo

# Database (optional)
DATABASE_PROVIDER=sqlite
SQLITE_DATABASE_PATH=./data/test-results.db

# PR Provider (optional - for auto-PR generation)
PR_PROVIDER=github
BASE_BRANCH=main
```

### **4. Add to Playwright Config**

Update your `playwright.config.ts`:

```typescript
import {defineConfig} from '@playwright/test';

export default defineConfig({
    reporter: [
        ['list'],
        [
            'playwright-ai-reporter',
            {
                // Test thresholds
                slowTestThreshold: 3,
                maxSlowTestsToShow: 5,

                // Output
                outputDir: './test-results',
                historyFile: './test-results/history.json',
                showStackTrace: true,
                commentMetadata: false, // Opt in to adjacent JSDoc @key values

                // AI & Automation features
                generateFix: true, // Generate AI fix suggestions
                createBug: false, // Auto-create bugs for failures
                generatePR: false, // Auto-create PRs with fixes
                publishToDB: false, // Save to database
                sendEmail: false, // Send email notifications
            },
        ],
    ],
});
```

### **5. Validate Setup**

```bash
npx playwright-ai-reporter doctor
```

To scaffold a typed reporter settings file and a GitHub Actions artifact workflow first, run
`npx playwright-ai-reporter init`. Existing files are not overwritten unless you explicitly add
`--force`. Import the generated default export into `playwright.config.ts` and pass it as the
reporter's second tuple value.

### **6. Run Your Tests**

```bash
# From the examples folder
npm test
```

That's it! The reporter will now analyze failures, generate AI-powered fix suggestions, and optionally create bugs, PRs, or store results in a database based on your configuration.

---

## **🚀 Installation**

### **NPM**

```bash
npm install playwright-ai-reporter --save-dev
```

### **Yarn**

```bash
yarn add -D playwright-ai-reporter
```

### **PNPM**

```bash
pnpm add -D playwright-ai-reporter
```

---

## **⚙️ Configuration**

### **Reporter Configuration Options**

| Option                    | Type      | Default                    | Description                                                                                                                                                                                                                             |
| ------------------------- | --------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slowTestThreshold`       | `number`  | `5`                        | Tests slower than this (seconds) are flagged as slow                                                                                                                                                                                    |
| `maxSlowTestsToShow`      | `number`  | `3`                        | Maximum number of slow tests to display in report                                                                                                                                                                                       |
| `timeoutWarningThreshold` | `number`  | `30`                       | Warn if tests approach this timeout value (seconds)                                                                                                                                                                                     |
| `showStackTrace`          | `boolean` | `true`                     | Include full stack traces in error reports                                                                                                                                                                                              |
| `outputDir`               | `string`  | `./test-results`           | Directory for JSON output files, the HTML report and AI-generated fixes                                                                                                                                                                 |
| `historyFile`             | `string`  | `<outputDir>/history.json` | Where the last 30 runs are kept for flaky detection and the trend. Playwright empties its own `outputDir` before every run, so when `outputDir` is Playwright's `outputDir` set this elsewhere, for example `test-results/history.json` |
| `commentMetadata`         | `boolean` | `false`                    | Read custom `@key value` metadata from the adjacent JSDoc block above a test. Explicit `meta()` values override comment values                                                                                                         |
| `generateFix`             | `boolean` | `false`                    | Generate AI-powered fix suggestions (saves to files)                                                                                                                                                                                    |
| `createBug`               | `boolean` | `false`                    | Auto-create bugs for failures (requires bug tracker)                                                                                                                                                                                    |
| `closeFixedBugs`          | `boolean` | `false`                    | Close open `test-failure` bugs whose test passed this run (requires bug tracker)                                                                                                                                                        |
| `generatePR`              | `boolean` | `false`                    | Auto-create PRs with fixes (requires `generateFix=true`)                                                                                                                                                                                |
| `publishToDB`             | `boolean` | `false`                    | Publish test results to database (requires DB provider)                                                                                                                                                                                 |
| `sendEmail`               | `boolean` | `false`                    | Send email notifications (requires email configuration)                                                                                                                                                                                 |

### **Feature Workflows**

#### **Generate Fix Only** (Default)

```typescript
{ generateFix: true, createBug: false, generatePR: false, publishToDB: false }
// → Creates AI fix suggestions in test-results/fixes/
```

#### **Create Bugs for Failures**

```typescript
{ generateFix: false, createBug: true, generatePR: false, publishToDB: false }
// → Creates bugs in GitHub/Jira/Azure DevOps for each failure
```

#### **Generate Fix + Auto PR**

```typescript
{ generateFix: true, createBug: false, generatePR: true, publishToDB: false }
// → Creates fix files + topic branch + draft PR with fixes
```

#### **Full Stack** (All Features)

```typescript
{ generateFix: true, createBug: true, generatePR: true, publishToDB: true, sendEmail: true }
// → AI fixes + bug tracking + PRs + database logging + email notifications
```

### **Workflow: AI Fix → Topic Branch → PR**

1. **Test Fails** → AI analyzes failure and generates fix suggestion
2. **Generate Fix** (`generateFix: true`) → Creates fix files in `test-results/fixes/`
3. **Create Branch** (`generatePR: true`) → Creates topic branch `autofix/test-name-{timestamp}`
4. **Commit Changes** → Commits the AI's corrected file to the topic branch, but only if it passes the safety checks below
5. **Create PR** → Opens draft PR from topic branch → base branch with:
    - Error details and AI root-cause analysis
    - Labels: `auto-fix`, `test-failure`, `ai-generated`
    - Links to commit and test details
6. **Review & Merge** → Team reviews draft PR before merging

**Safety checks.** The model must finish its answer with a `## Corrected file` heading and one fenced code block containing the complete file. Only that block is ever considered for a commit; code elsewhere in the answer is explanation. The reporter rejects the file, creates no branch or PR, and logs why when it:

- is missing, empty or identical to the original
- contains markdown fences
- changes the file size by more than 50%
- no longer defines any tests
- has fewer assertions than the original
- adds a `test.skip` / `test.fixme` / `.skip(` that was not there
- adds a `waitForTimeout`

If the AI call itself fails, no fix file is written and nothing is committed.

### **Workflow: Failure → Bug → Fix → Verified Close**

```text
failing run -> AI root cause -> GitHub issue -> developer / Copilot agent fixes -> PR run -> merge -> green run closes the issue
```

1. **Main or nightly run fails.** With `generateFix: true` and `createBug: true` the reporter analyses each failure and files one issue per failing test. The issue contains the test metadata, the AI analysis, the run URL, branch, commit and an artifacts link. A repeat failure comments on the open issue instead of creating a duplicate.
2. **A developer (or the Copilot coding agent) fixes it** and opens a pull request containing `Fixes #<issue>`.
3. **The pull request run verifies the fix.** Do not enable `createBug` or `closeFixedBugs` on pull request runs.
4. **After the merge, the next run on the main branch is green.** With `closeFixedBugs: true` the reporter closes the open `test-failure` issue for every test that passed on its first attempt, with a comment linking the run. A flaky test (failed, then passed on retry) is not treated as verified. Issues are matched to tests by exact title.

Example GitHub Actions step:

```yaml
permissions:
    contents: read
    issues: write
    copilot-requests: write # only when AI_PROVIDER=copilot

steps:
    - run: npm install --global @github/copilot # only when AI_PROVIDER=copilot
    - run: npx playwright test
      env:
          AI_PROVIDER: copilot
          BUG_TRACKER_PROVIDER: github
          GITHUB_TOKEN: ${{ github.token }}
          GITHUB_OWNER: ${{ github.repository_owner }}
          GITHUB_REPO: ${{ github.event.repository.name }}
```

```typescript
// playwright.config.ts
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

reporter: [
    [
        'playwright-ai-reporter',
        {
            generateFix: !isPullRequest,
            createBug: !isPullRequest,
            closeFixedBugs: !isPullRequest,
        },
    ],
],
```

### **Bug tracker settings come from the environment**

Setting `BUG_TRACKER_PROVIDER` is enough: the reporter reads the rest from environment variables, so you do not need to pass a config object.

| Tracker      | Variables                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub       | `GITHUB_TOKEN` (or `GH_TOKEN`), `GITHUB_OWNER` and `GITHUB_REPO` (or `GITHUB_REPOSITORY` as `owner/repo`)                                                 |
| Azure DevOps | `AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`; optional `AZURE_DEVOPS_AREA_PATH`, `AZURE_DEVOPS_ITERATION_PATH`, `AZURE_DEVOPS_TAGS` |
| Jira         | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`; optional `JIRA_ISSUE_TYPE`                                                               |

The same variables configure the matching PR provider (Azure DevOps adds `AZURE_DEVOPS_REPO`). To assign new bugs, set `BUG_ASSIGNEE` to a user name the tracker accepts. The reporter no longer sends the owning team as the assignee: GitHub rejects team names with a `422`, and when an assignee is rejected the issue is created unassigned instead of failing.

### **Declare test metadata with `meta()`**

```typescript
import {test} from '@playwright/test';
import {meta} from 'playwright-ai-reporter/meta';

test('completes purchase', async ({page}) => {
    await meta({priority: 'P0', severity: 'blocker', owner: 'forms-qa', feature: 'payment', story: 'SHOP-250'});
    // ...
});
```

`meta()` attaches JSON named `meta` to the test (it also shows in Playwright's own report). The reporter reads it from the latest attempt and uses it to:

- rank **Needs attention** by priority and severity and group the **Breakdown** by priority, severity, feature and owner
- replace the guessed owning team with `owner`, in the report, the Markdown summary and the bug
- add a **Test metadata** section to the bug it files

Any other keys you pass are shown as well. An attachment named `meta` or `<anything>:meta`, or with a content type ending in `-meta`, is recognised, so an existing helper keeps working.

For existing suites that cannot import `meta()`, enable `commentMetadata: true` and place custom
tags in the adjacent JSDoc block:

```typescript
/**
 * @priority P1
 * @severity major
 * @owner checkout-qa
 * @feature payment
 */
test('completes purchase', async ({page}) => {
    // ...
});
```

Only the adjacent JSDoc block is read. Standard tags such as `@param`, `@returns`, `@type`, and
`@example` are ignored. When both forms are present, values attached through `meta()` win.

### **Record API calls with `recordApi()`**

```typescript
import {recordApi} from 'playwright-ai-reporter/recorder';

test('lists employees', async ({page}) => {
    const api = recordApi(page);
    // ... drive the page ...
    await api.attach(); // call it before an assertion that can fail
});
```

Or record every test without touching it:

```typescript
import {test as base} from '@playwright/test';
import {apiRecorderFixture} from 'playwright-ai-reporter/recorder';

export const test = base.extend({...apiRecorderFixture});
```

Direct Playwright API calls are opt-in and do not patch Playwright prototypes:

```typescript
import {test as base, type APIRequestContext} from '@playwright/test';
import {apiRequestRecorderFixture} from 'playwright-ai-reporter/recorder';

const test = base.extend<{recordedRequest: APIRequestContext}>(apiRequestRecorderFixture);

test('creates an employee', async ({recordedRequest}) => {
    await recordedRequest.post('/employees', {data: {name: 'Ada'}});
});
```

The wrapper records `fetch`, `get`, `post`, `put`, `patch`, `delete`, and `head`. Browser recording
captures fetch and XHR calls. Up to 100 calls per test are kept. Method, URL, status, timing, headers
and bodies appear in the **API** tab and in each failure. Calls are kept only for tests that did not
pass cleanly. **Secrets are masked before anything is stored**: sensitive header names
(`Authorization`, `Cookie`, `*token*`, `*secret*`, `*api-key*`, ...), sensitive query parameters and
sensitive JSON keys become `****`. Response bodies are truncated at 4,000 characters.

The same redaction boundary protects generated JSON, HTML, Markdown and history files, AI prompts
and responses, issue and pull-request text, notification bodies, and database records. It recognizes
common provider tokens, JWTs, authorization credentials, Luhn-valid payment-card numbers, values in
sensitive environment variables, and values learned from sensitive structured keys. Keep credentials
in secret variables even with this defense in depth; the reporter intentionally does not rewrite
source files or attached binary artifacts.

### **Run history and flaky detection**

The reporter keeps the outcome of the last 30 runs in `historyFile`. Together with the retries of the current run it gives every test that did not pass first time one of these verdicts:

| Verdict           | Meaning                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Flaky**         | It passed on retry, failed in two separate streaks, or failed once right before a passing run |
| **New failure**   | It fails now and passed in the previous run (or there is no history)                          |
| **Known failure** | It failed in the previous run too: a streak that has not ended is broken, not flaky           |

Each verdict comes with the evidence and a next step. The advice never says to raise a timeout or add a sleep. Cache `historyFile` between CI runs (see below) or every run starts with no history.

`testFailures.json` now holds the failures of the current run only, one entry per test, instead of growing across runs. Terminal colour codes are removed from errors when they are captured.

### **Publish the report as its own artifact**

The report is one file with its code, data and small screenshots (up to 600 KB each, 8 MB in total) inside it, and it needs no network. Publish it separately from the raw results so a reviewer can download and open just that file. Videos and traces stay separate files and open when kept next to the report.

The reporter also writes `summary.md` next to the report. On GitHub Actions it is appended to the job summary automatically (`GITHUB_STEP_SUMMARY`). On Azure Pipelines it is added to the build page (`TF_BUILD`).

GitHub Actions:

```yaml
- uses: actions/cache/restore@v4
  with:
      path: test-results/history.json
      key: test-history-${{ github.ref_name }}-${{ github.run_id }}
      restore-keys: test-history-${{ github.ref_name }}-

- run: npx playwright test

- uses: actions/cache/save@v4
  if: always()
  with:
      path: test-results/history.json
      key: test-history-${{ github.ref_name }}-${{ github.run_id }}

- uses: actions/upload-artifact@v4
  if: always()
  with:
      name: test-health-report
      path: test-results/test-health-report.html
```

Azure Pipelines (a complete pipeline is in [examples/azure-pipelines](./examples/azure-pipelines/azure-pipelines.yml)):

```yaml
- task: PublishPipelineArtifact@1
  condition: always()
  inputs:
      targetPath: test-results/test-health-report.html
      artifact: test-health-report
```

### **Merge Playwright shard reports**

Keep each shard's reporter output and referenced artifacts together, then merge two or more shard
directories after all matrix jobs finish:

```powershell
npx playwright-ai-reporter merge `
  test-results\shard-1 `
  test-results\shard-2 `
  --output test-results\merged
```

The output directory must be absent or empty. The command:

- validates the versioned `testSummary.json` contract and also accepts legacy unversioned reports;
- rejects duplicate tests, inconsistent failure files, conflicting build identities, unsupported
  schema versions, and missing evidence;
- renumbers worker lanes and combines attempts, API evidence, AI analysis, build metadata, and the
  common history prefix;
- copies screenshots, traces, videos, error context, and saved AI analysis under
  `merged/artifacts/`;
- rejects absolute paths, directory traversal, and symlinks that would copy evidence from outside a
  shard directory;
- writes merged `testSummary.json`, `testFailures.json`, `merge-manifest.json`, `summary.md`, and a
  standalone `test-health-report.html`.

The merge is staged and renamed into place only after validation and report generation succeed, so
a failed merge does not leave a success-shaped partial report.

### **Onboarding commands and CI examples**

```bash
npx playwright-ai-reporter --help
npx playwright-ai-reporter init
npx playwright-ai-reporter doctor --output test-results/ai-report
npx playwright-ai-reporter snippets
```

| Command | Purpose | Important options and behavior |
| ------- | ------- | ------------------------------ |
| `init` | Creates `playwright-ai-reporter.config.ts` and `.github/workflows/playwright-ai-report.yml`. | Use `--dir <directory>` to choose the project. Existing files are preserved unless `--force` is supplied. |
| `doctor` | Checks Node.js, compiled report assets, Playwright and Chromium availability, output writability, and variables for selected providers. | Use `--output <directory>` to check the intended report location. It does not install, authenticate, connect to providers, or print secret values. Any failed check produces a non-zero exit code. |
| `snippets` | Creates `.vscode/playwright-ai-reporter.code-snippets` for reporter configuration, `meta()`, and direct API capture. | Supports `--dir <directory>` and the explicit `--force` overwrite option. |
| `merge` | Combines two or more shard directories into one deterministic standalone report. | Requires `--output <directory>`. The output must be absent or empty and different from every input. |

Complete publication examples are available for
[GitHub Actions sharding](./examples/github-actions-sharded.yml),
[GitLab CI](./examples/gitlab-ci.yml), [Jenkins](./examples/Jenkinsfile), and
[Azure Pipelines](./examples/azure-pipelines/azure-pipelines.yml). The sharded examples retain each
shard directory until the merge job and publish the merged standalone HTML together with its raw
evidence.

---

## **🔌 Provider Support**

### **AI Providers**

| Provider               | Status              | Configuration                                                                                                          |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Azure OpenAI**       | ✅ Production Ready | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`                                                                |
| **OpenAI**             | ✅ Production Ready | `OPENAI_API_KEY`, `OPENAI_MODEL`                                                                                       |
| **Anthropic (Claude)** | ✅ Production Ready | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                                                                                 |
| **Google AI (Gemini)** | ✅ Production Ready | `GOOGLE_AI_API_KEY`, `GOOGLE_AI_MODEL`                                                                                 |
| **Mistral AI**         | ✅ Production Ready | `MISTRAL_API_KEY`, `MISTRAL_MODEL`                                                                                     |
| **GitHub Copilot**     | ✅ Production Ready | `AI_PROVIDER=copilot`, `GITHUB_TOKEN` or CLI login; optional `COPILOT_MODEL`, `COPILOT_CLI_PATH`, `COPILOT_TIMEOUT_MS` |

**GitHub Copilot provider.** Runs the [GitHub Copilot CLI](https://docs.github.com/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions) non-interactively with every tool disabled, so the model can only return text. The prompt is sent on stdin. Install the CLI (`npm install -g @github/copilot`). In GitHub Actions authenticate with the workflow `GITHUB_TOKEN` and `permissions: copilot-requests: write`; an organization owner must enable **Allow use of Copilot CLI billed to the organization**. Locally it uses your CLI login or `GH_TOKEN` / `GITHUB_TOKEN`. The CLI ignores `temperature` and token limits, and a call can take over a minute, so the timeout defaults to 5 minutes (`COPILOT_TIMEOUT_MS`).

### **Bug Trackers**

| Provider          | Status              | Configuration                                                      |
| ----------------- | ------------------- | ------------------------------------------------------------------ |
| **GitHub Issues** | ✅ Production Ready | `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`                      |
| **Azure DevOps**  | ✅ Production Ready | `AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` |
| **Jira**          | ✅ Production Ready | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`    |

### **Databases**

| Provider       | Status              | Configuration                                                  |
| -------------- | ------------------- | -------------------------------------------------------------- |
| **SQLite**     | ✅ Production Ready | `SQLITE_DB_PATH` (optional)                                    |
| **MySQL**      | ✅ Production Ready | `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` |
| **PostgreSQL** | 🚧 Coming Soon      | -                                                              |

### **Notifications**

| Provider            | Status              | Configuration                                                          |
| ------------------- | ------------------- | ---------------------------------------------------------------------- |
| **Email (SMTP)**    | ✅ Production Ready | `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_TO` |
| **Slack**           | 🚧 Coming Soon      | `SLACK_WEBHOOK_URL`                                                    |
| **Microsoft Teams** | 🚧 Coming Soon      | `TEAMS_WEBHOOK_URL`                                                    |

### **PR Providers**

| Provider         | Status              | Configuration                       |
| ---------------- | ------------------- | ----------------------------------- |
| **GitHub**       | ✅ Production Ready | Uses `GITHUB_*` configuration       |
| **Azure DevOps** | ✅ Production Ready | Uses `AZURE_DEVOPS_*` configuration |

---

## **💻 Usage Examples**

### **Basic Usage (Environment Variables)**

```typescript
// playwright.config.ts
import {defineConfig} from '@playwright/test';

export default defineConfig({
    reporter: [
        [
            'playwright-ai-reporter',
            {
                generateFix: true,
                categorizeFailures: true,
                slowTestThreshold: 3,
                maxSlowTestsToShow: 5,
            },
        ],
    ],
});
```

### **Using Provider Registry**

```typescript
import {ProviderRegistry} from 'playwright-ai-reporter';

// Initialize providers
await ProviderRegistry.initialize({
    ai: {type: 'openai'},
    bugTracker: {type: 'github'},
    database: {type: 'sqlite'},
});

// Get providers
const ai = await ProviderRegistry.getAIProvider();
const bugTracker = await ProviderRegistry.getBugTrackerProvider();
const db = await ProviderRegistry.getDatabaseProvider();
```

### **Direct Factory Usage**

```typescript
import {AIProviderFactory} from 'playwright-ai-reporter';

// Create specific provider
const provider = await AIProviderFactory.createProvider('anthropic');

// Generate completion
const response = await provider.generateCompletion([
    {role: 'system', content: 'You are a test engineer.'},
    {role: 'user', content: 'Analyze this test failure...'},
]);

console.log(response.content);
```

### **Complete Workflow Example**

```typescript
import {ReporterWorkflow} from 'playwright-ai-reporter';

// Initialize
await ReporterWorkflow.initialize();

// Process test failure
await ReporterWorkflow.processTestFailure(failure, sourceCode);

// Save test run
const runId = await ReporterWorkflow.saveTestRun(summary);

// Send notifications
await ReporterWorkflow.sendNotification(summary, failures);

// Cleanup
await ReporterWorkflow.cleanup();
```

For more examples, check the **[examples](./examples/)** folder.

---

## **📋 Output Examples**

### **Successful Run**

```plaintext
🚀 Starting test run: 3 tests using 2 workers
✅ Login test passed in 1.23s
✅ API integration test passed in 2.45s
⚠️ Payment test was skipped

✅ All 3 tests passed | 1 skipped | ⏱ Total: 3.68s

🖥️ Running locally

Additional Metrics:
- Average passed test time: 1.84s
- Slowest test took: 2.45s
- Top 3 slowest tests:
  1. API integration test: 2.45s
  2. Login test: 1.23s

⚠️ Warning: 1 test was skipped.
   Please ensure to test the skipped scenarios manually before deployment.
```

### **Failed Run with AI Fix Suggestions**

```plaintext
🚀 Starting test run: 3 tests using 2 workers
✅ Login test passed in 1.23s
❌ API test failed in 2.45s
🔄 Retry attempt for "API test" (failed) in 2.50s
⚠️ Payment test was skipped

❌ 1 of 3 tests failed | 1 passed | 1 skipped | ⏱ Total: 6.18s

🤖 Generating AI-powered fix suggestions...
Generating fix suggestion for: API test
✅ Fix suggestion generated:
  - Prompt: ./test-results/prompts/api-test.md
  - Fix: ./test-results/fixes/fix-api-test.md

🔄 Generating pull request with fix...
   Creating topic branch: autofix/api-test-2025-12-30T10-30-45
   ✅ Branch created successfully
   Committing changes to autofix/api-test-2025-12-30T10-30-45
   ✅ Changes committed: a1b2c3d
   Creating pull request: autofix/api-test-2025-12-30T10-30-45 → main
✅ Pull request created successfully:
   PR #42: https://github.com/yourorg/yourrepo/pull/42
   Branch: autofix/api-test-2025-12-30T10-30-45 → main
   Status: open (draft)

AI fix suggestion generation complete

Additional Metrics:
- Average passed test time: 1.23s
- Slowest test took: 1.23s

Test Failures:
--- Failure #1 ---
  Test: API test
  Category: NetworkError
  Error: Connection timeout
  Stack Trace:
    at Connection.connect (/src/api/connection.ts:45:7)
```

### **HTML Test Health Report**

<p align="center">
  <img src="docs/test-health-report-full.png" alt="Full-page Playwright AI Test Health Report showing pass rate, failures, priority breakdown, slowest tests, trend, skipped tests, and build environment" width="100%" />
</p>

<p align="center"><em>Full standalone report overview generated by Playwright AI Reporter.</em></p>

Download or inspect the matching
[standalone HTML sample report](./docs/test-health-report-sample.html). It contains the same embedded
data, CSS, and JavaScript as the screenshot and does not require a web server.

After each test run, a self-contained HTML report is automatically generated:

```plaintext
📊 Generating self-contained test health report...
  ✓ Loaded testSummary.json (25 tests)
  ✓ Loaded testFailures.json (2 failures)
  ✓ Loaded HTML template
  ✓ Loaded CSS
  ✓ Loaded JavaScript
  ✓ Generated standalone report: E:\project\test-results\test-health-report.html

╔══════════════════════════════════════════════════════════════╗
║                    📊 Test Health Report                     ║
╠══════════════════════════════════════════════════════════════╣
║  Open in browser: file:///E:/project/test-results/test-health-report.html
║                                                              ║
║  Or run: npx playwright show-report (if using Playwright)   ║
╚══════════════════════════════════════════════════════════════╝
```

The report is a single HTML file with embedded test data, CSS, and JavaScript and no external
requests: it opens from disk, from a CI artifact, or from an email. Generation verifies that the
embedded data and assets exist and rejects external stylesheet or script references. It contains:

- 🧭 **Tabs**: Overview, Tests, Failures, API and Timeline
- 🎯 **Overview**: pass-rate card with the change from the previous run, new vs known failures, a dot for every test in run order, **Needs attention** ranked by priority and severity, and the run environment
- 🧩 **Failure clusters**: failures that share an error shape (numbers, quoted values and URLs are ignored) are grouped, so you fix one cause once
- 📊 **Breakdown**: by priority, severity, feature, owner, spec file or project; click a row to filter the Tests tab
- 🔁 **Flaky analysis**: verdict, failure rate, pattern, evidence and next step for each test, plus a Markdown export
- 🧾 **Failure details**: test metadata, error, AI analysis when `generateFix` is on, screenshot, trace (copy-ready `show-trace` command and download), API calls and a link to the pull request when one was opened
- 📡 **API tab**: every recorded call across the run, filterable, failed calls first-class
- ⏱️ **Timeline**: one lane per worker with real start times
- 🐌 **Slowest**, **Flakiest**, **Skipped** and **Trend** panels; the trend comes from the history file
- 🎨 **Eight themes**: Light, Aquatic, Forest, Sunset, Midnight, Corporate and two high-contrast themes, remembered per browser, with the dark theme chosen automatically when your system prefers it

Features that need data say so instead of showing placeholders: an empty AI panel tells you to set `generateFix` and `AI_PROVIDER`, and an empty trend tells you to set `historyFile`. Nothing in the report is sample data.

---

## **❓ Frequently Asked Questions (FAQs)**

### **General**

<details>
<summary><strong>What is Playwright AI Reporter?</strong></summary>

Playwright AI Reporter is an enterprise-grade, AI-powered test reporter for Playwright that automatically analyzes test failures, creates bug reports, generates fix suggestions, and can even submit auto-healing pull requests. It uses a flexible provider-based architecture that supports multiple AI services, bug trackers, databases, and notification systems.

</details>

<details>
<summary><strong>Which AI providers are supported?</strong></summary>

We support:

- **Azure OpenAI** (with Managed Identity support)
- **OpenAI** (GPT-3.5, GPT-4)
- **Anthropic Claude** (Claude 3 Opus, Sonnet, Haiku)
- **Google AI** (Gemini Pro, Gemini Pro Vision)
- **Mistral AI** (Mistral 7B, Mixtral 8x7B)

You can easily switch between providers by changing your environment configuration.

</details>

<details>
<summary><strong>Do I need to use all features?</strong></summary>

No! The reporter is modular. You can:

- Use just AI fix suggestions (`generateFix: true`)
- Add bug tracking (`createBug: true`)
- Enable auto-healing PRs (`generatePR: true`)
- Store results in a database (`publishToDB: true`)
- Send notifications (`sendEmail: true`)

Mix and match based on your needs. Start simple and add features as needed.

</details>

<details>
<summary><strong>Is this production-ready?</strong></summary>

Yes! The reporter is:

- Written in TypeScript with full type safety
- Thoroughly tested in real-world scenarios
- Used in CI/CD pipelines
- Battle-tested with enterprise applications
- Actively maintained and updated
      </details>

### **Installation & Setup**

<details>
<summary><strong>How do I get started quickly?</strong></summary>

1. Install: `npm install playwright-ai-reporter --save-dev`
2. Copy config: `cp examples/env-configs/.env.github-stack .env`
3. Add your API keys to `.env`
4. Update `playwright.config.ts` to use the reporter
5. Run: `npx playwright test`

Check the [Quick Start](#-quick-start) section for details.

</details>

<details>
<summary><strong>Which environment file should I use?</strong></summary>

Choose based on your stack:

- **`.env.github-stack`** - GitHub Issues + Mistral AI + SQLite (recommended for open source)
- **`.env.azure-stack`** - Azure DevOps + Azure OpenAI + MySQL (recommended for enterprise)
- **`.env.openai-jira`** - Jira + OpenAI + SQLite (recommended for startups/agile teams)
- **`.env.anthropic-minimal`** - Claude AI only (minimal setup)

All examples are in `examples/env-configs/`.

</details>

<details>
<summary><strong>Do I need to install all peer dependencies?</strong></summary>

No! Install only what you need:

- `@azure/identity` - Only if using Azure OpenAI with Managed Identity
- `@octokit/rest` - Only if using GitHub Issues/PRs
- `azure-devops-node-api` - Only if using Azure DevOps
- `mysql2` - Only if using MySQL database
- `nodemailer` - Only if using email notifications

The reporter will work with just your AI provider installed.

</details>

### **AI & Fix Suggestions**

<details>
<summary><strong>How accurate are the AI fix suggestions?</strong></summary>

The AI analyzes:

- Test code and error messages
- Stack traces and context
- Playwright best practices
- Error patterns (timeout, selector, network, etc.)

While not perfect, the suggestions are typically actionable starting points. Always review AI-generated fixes before applying them. We recommend using `generatePR: true` which creates draft PRs for mandatory code review.

</details>

<details>
<summary><strong>Can I customize the AI prompts?</strong></summary>

Yes! The prompts are generated in `test-results/prompts/` before being sent to the AI. You can:

1. Review generated prompts
2. Modify the prompt generation logic in `src/utils/genaiUtils.ts`
3. Create custom templates
4. Add project-specific context

Check the documentation for advanced customization.

</details>

<details>
<summary><strong>Which AI provider is most cost-effective?</strong></summary>

For cost optimization:

- **Mistral AI** - Most affordable, good quality
- **Google Gemini** - Low cost, high token limits
- **OpenAI GPT-3.5** - Balanced cost/performance
- **Azure OpenAI** - Best for enterprise with existing Azure credits
- **Anthropic Claude** - Premium pricing, best quality

Choose based on your budget and quality requirements.

</details>

### **Auto-Healing & PRs**

<details>
<summary><strong>How does auto-healing work?</strong></summary>

The auto-healing workflow:

1. Test fails → AI generates fix
2. Reporter creates topic branch: `autofix/test-name-timestamp`
3. Commits AI fix to topic branch
4. Creates draft PR from topic branch to base branch
5. Team reviews and merges if fix is correct

PRs are always created as **drafts** to ensure mandatory code review. Enable with `generatePR: true` in config.

</details>

<details>
<summary><strong>Are auto-generated PRs safe?</strong></summary>

Yes, because:

- PRs are created as **drafts** requiring review
- Changes are committed to topic branches, not main
- AI suggestions are clearly labeled
- Full test context is included in PR description
- Team has final approval before merging

Never auto-merge AI-generated code without review.

</details>

<details>
<summary><strong>Can I disable auto-healing for specific tests?</strong></summary>

Yes! Use test annotations:

```typescript
test(
    'critical test',
    {
        annotation: {type: 'no-auto-heal', description: 'Manual review required'},
    },
    async ({page}) => {
        // Test code
    },
);
```

The reporter will skip PR generation for annotated tests.

</details>

### **Integration & Providers**

<details>
<summary><strong>Can I use multiple bug trackers?</strong></summary>

Not simultaneously. Choose one bug tracker provider:

- GitHub Issues
- Azure DevOps Work Items
- Jira Tickets

However, you can easily switch between them by changing the `BUG_TRACKER_PROVIDER` environment variable.

</details>

<details>
<summary><strong>How do I add a custom provider?</strong></summary>

Implement the appropriate interface:

```typescript
import {IAIProvider} from 'playwright-ai-reporter';

export class CustomAIProvider implements IAIProvider {
    async generateCompletion(messages) {
        // Your implementation
    }
}
```

See [docs/PROVIDERS.md](./docs/PROVIDERS.md) for detailed instructions on adding custom providers.

</details>

<details>
<summary><strong>Can I use this in CI/CD?</strong></summary>

Absolutely! The reporter:

- Detects CI environment automatically
- Extracts build information (GitHub Actions, Azure Pipelines, Jenkins, etc.)
- Integrates with artifact storage
- Works with pipeline secrets for API keys
- Generates structured JSON output for pipeline steps

Check `examples/tests/` for CI/CD integration examples.

</details>

### **Database & Analytics**

<details>
<summary><strong>What data is stored in the database?</strong></summary>

Two tables:

- **`test_runs`** - Test run metadata (timestamp, environment, branch, commit, totals, duration)
- **`test_results`** - Individual test results (test_id, status, duration, errors, retries)

Indexed for fast queries on timestamp, test_run_id, test_id, and status.

</details>

<details>
<summary><strong>Can I query historical test data?</strong></summary>

Yes! Use the database provider:

```typescript
import {ProviderRegistry} from 'playwright-ai-reporter';

const db = await ProviderRegistry.getDatabaseProvider();
const results = await db.query('SELECT * FROM test_results WHERE status = ? AND timestamp > ?', ['failed', oneWeekAgo]);
```

Perfect for failure trend analysis and flaky test identification.

</details>

### **Troubleshooting**

<details>
<summary><strong>Why am I not seeing AI fix suggestions?</strong></summary>

Check:

1. `generateFix: true` in `playwright.config.ts`
2. AI provider configured in `.env`
3. Valid API key
4. Network connectivity to AI service
5. Check console output for error messages

Run `npm run validate:config` to check your setup.

</details>

<details>
<summary><strong>PRs are not being created</strong></summary>

Verify:

1. `generatePR: true` and `generateFix: true` in config
2. PR provider configured (`PR_PROVIDER=github`)
3. Valid GitHub/Azure DevOps token with repo permissions
4. Git repository initialized
5. No uncommitted changes blocking branch creation

Check logs for specific error messages.

</details>

<details>
<summary><strong>How do I debug configuration issues?</strong></summary>

Run the configuration validator:

```bash
npm run validate:config
```

This will check:

- Environment variables
- API keys validity
- Provider connectivity
- Configuration completeness
- Permission issues

Fix any reported issues before running tests.

</details>

<details>
<summary><strong>SQLite3 native binding errors in CI</strong></summary>

**Problem**: You see errors like `Could not locate the bindings file` for sqlite3 in CI environments.

**Solution**: As of v0.0.2, SQLite dependencies are optional and lazy-loaded. If you don't need database features:

```typescript
{
    reporters: [
        [
            'playwright-ai-reporter',
            {
                publishToDB: false, // Disable database - no sqlite3 needed!
                // ... other options
            },
        ],
    ];
}
```

The reporter will work perfectly without sqlite3 installed.

**Alternative solutions**:

1. Use MySQL instead: `DATABASE_PROVIDER=mysql`
2. See [SQLITE-FIX.md](./SQLITE-FIX.md) for detailed troubleshooting

</details>

### **Advanced Usage**

<details>
<summary><strong>Can I use this with TypeScript?</strong></summary>

Yes! The reporter is written in TypeScript and provides full type definitions. Import types:

```typescript
import type {IAIProvider, IBugTrackerProvider, IDatabaseProvider} from 'playwright-ai-reporter';
```

</details>

<details>
<summary><strong>How do I contribute?</strong></summary>

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Code style guidelines
- Testing requirements
- PR process
- Development setup

Or check [GitHub Issues](https://github.com/deepakkamboj/playwright-ai-reporter/issues) for open tasks.

</details>

<details>
<summary><strong>Where can I get help?</strong></summary>

- 📖 [Documentation](./docs/README.md)
- 🐛 [Issue Tracker](https://github.com/deepakkamboj/playwright-ai-reporter/issues)
- 💬 [Discussions](https://github.com/deepakkamboj/playwright-ai-reporter/discussions)
- 📧 Email: support@playwright-ai-reporter.dev
      </details>

---

## **📚 Documentation**

### **📖 [Complete Documentation Hub →](./docs/README.md)**

#### **Quick Links**

- **[Quick Start Guide](./docs/QUICKSTART.md)** - Get started in 5 minutes
- **[Environment Configuration](./docs/ENV_CONFIG_GUIDE.md)** - Complete setup guide with sample configurations
- **[Provider Documentation](./docs/PROVIDERS.md)** - Detailed provider documentation and usage
- **[Architecture & Design](./docs/design.md)** - System architecture and design decisions
- **[Implementation Details](./docs/IMPLEMENTATION_SUMMARY.md)** - Technical implementation overview
- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

#### **Examples**

- **[Environment Config Examples](./examples/env-configs/)** - Pre-configured .env files for different stacks
- **[Test Examples](./examples/tests/)** - Sample test files demonstrating reporter usage
- **[Workflow Examples](./src/examples/)** - Code examples for common workflows

> 💡 **New here?** Start with the [Quick Start Guide](./docs/QUICKSTART.md) and [ENV_CONFIG_GUIDE](./docs/ENV_CONFIG_GUIDE.md)

---

## **🤝 Contributing**

We welcome contributions! Here's how you can help:

1. **Fork** the repository
2. **Create** your feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes and commit: `git commit -m 'Add amazing feature'`
4. **Push** to your fork: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

Please ensure your PR:

- Follows the existing code style
- Includes appropriate tests
- Updates documentation as needed
- Describes the changes made

### **Adding New Providers**

See [docs/PROVIDERS.md](./docs/PROVIDERS.md#adding-new-providers) for instructions on adding new provider implementations.

---

## **🌟 Why Choose This Reporter?**

✅ **Provider Independence** - Not locked into any single service  
✅ **Enterprise Ready** - Azure integration, managed identity, MySQL support  
✅ **Cost Optimized** - Choose the most cost-effective AI provider  
✅ **Flexible** - Use only the features you need  
✅ **Extensible** - Easy to add new providers  
✅ **Type Safe** - Full TypeScript support  
✅ **Production Tested** - Battle-tested in real-world scenarios  
✅ **Well Documented** - Comprehensive docs and examples  
✅ **Active Development** - Regular updates and improvements  
✅ **Open Source** - MIT licensed, community-driven

---

## **🎯 Use Cases**

### **Enterprise CI/CD Pipeline**

- Automatic bug creation in Azure DevOps for test failures
- Store historical test data in MySQL for trend analysis
- Email notifications to QA team
- Azure OpenAI for fix suggestions with enterprise security

### **Open Source Projects**

- GitHub Issues for bug tracking
- SQLite for lightweight data storage
- GitHub PRs for automated fixes
- OpenAI or Anthropic for AI suggestions

### **Startup/Agile Teams**

- Slack notifications for instant alerts
- Jira integration for sprint planning
- Google AI (Gemini) for cost-effective analysis
- Quick iteration with auto-healing

---

## **📝 License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## **🙏 Acknowledgments**

- Built with ❤️ for the [Playwright](https://playwright.dev/) community
- Inspired by the need for better test reporting and automatic debugging in CI/CD pipelines
- Multi-provider AI support: Azure OpenAI, OpenAI, Anthropic, Google AI, Mistral AI
- Thanks to all contributors who help make this reporter better

---

## **📞 Support**

- 📖 [Documentation](./docs/README.md)
- 🐛 [Issue Tracker](https://github.com/deepakkamboj/playwright-ai-reporter/issues)
- 💬 [Discussions](https://github.com/deepakkamboj/playwright-ai-reporter/discussions)
- 📧 [Email Support](mailto:support@playwright-ai-reporter.dev)
- 🐦 [Twitter](https://twitter.com/playwright-ai-reporter)

---

**Made with ❤️ by [Deepak Kamboj](https://github.com/deepakkamboj) for the Playwright community**

⭐ **Star us on GitHub** if you find this useful!
