# Quick Start Guide - Playwright AI Test Reporter

## Installation

```bash
npm install @azure/identity
```

## Configuration

### 1. Create Environment File

Copy one of the pre-configured example files:

```bash
# For GitHub users (recommended for open source)
cp examples/env-configs/.env.github-stack .env

# For Azure users (recommended for enterprise)
cp examples/env-configs/.env.azure-stack .env

# For Jira users
cp examples/env-configs/.env.openai-jira .env

# For minimal setup
cp examples/env-configs/.env.anthropic-minimal .env
```

### 2. Configure Your Providers

Edit `.env` and set your provider choices:

```env
# Minimal configuration for getting started
AI_PROVIDER=azure-openai
BUG_TRACKER_PROVIDER=github
DATABASE_PROVIDER=sqlite

# Enable features
ENABLE_BUG_CREATION=true
ENABLE_DATABASE_LOGGING=true
ENABLE_AUTO_HEALING=true
ENABLE_PR_CREATION=false
```

### 3. Add Provider-Specific Configuration

#### For Azure OpenAI (Recommended for Enterprise)

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-01
```

Uses Azure managed identity - no API key needed!

#### For OpenAI (Quick Start)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

#### For GitHub Bug Tracking

```env
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo
```

### 4. Validate Configuration

Run the configuration validator:

```bash
npm run validate:config
```

This will check all your provider configurations and test connections.

## Usage

### Basic Setup in Playwright Config

```typescript
// playwright.config.ts
import {defineConfig} from '@playwright/test';

export default defineConfig({
    reporter: [
        [
            './src/reporter.ts',
            {
                // Reporter options
            },
        ],
    ],
});
```

### Using the Provider Framework

```typescript
import {ProviderRegistry} from './src/providers/ProviderRegistry';

// Initialize providers (loads from .env)
await ProviderRegistry.initialize();

// Get AI provider
const ai = await ProviderRegistry.getAIProvider();
const response = await ai.generateText('Analyze this test failure...');

// Get bug tracker
const bugTracker = await ProviderRegistry.getBugTrackerProvider();
await bugTracker.createBug({
    title: 'Test Failed',
    description: 'Details...',
    priority: BugPriority.High,
});

// Get database
const db = await ProviderRegistry.getDatabaseProvider();
await db.saveTestRun({
    name: 'Test Run',
    timestamp: new Date(),
    totalTests: 10,
    passedTests: 8,
    failedTests: 2,
});
```

### Using Individual Factories

```typescript
import {AIProviderFactory} from './src/providers/ai/AIProviderFactory';

// Create specific provider
const ai = await AIProviderFactory.createProvider('openai');

// Or create from environment
const ai = await AIProviderFactory.createFromEnv('AI_PROVIDER');
```

## Supported Providers

### AI Providers

- ✅ Azure OpenAI (recommended for enterprise)
- ✅ OpenAI
- ✅ Anthropic (Claude)
- ✅ Google AI (Gemini)
- ✅ Mistral AI

### Bug Trackers

- ✅ GitHub Issues
- ✅ Azure DevOps Work Items
- ✅ Jira

### Databases

- ✅ SQLite (default, no setup needed)
- ✅ MySQL
- ⏳ PostgreSQL (coming soon)

### Notifications

- ✅ Email (SMTP)
- ⏳ Slack (coming soon)
- ⏳ Microsoft Teams (coming soon)

### PR Providers

- ✅ GitHub
- ✅ Azure DevOps

## Common Configurations

### Minimal Setup (SQLite + OpenAI)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
DATABASE_PROVIDER=sqlite
ENABLE_DATABASE_LOGGING=true
```

### GitHub Integration

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

BUG_TRACKER_PROVIDER=github
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo

PR_PROVIDER=github
# Uses same GITHUB_* vars

ENABLE_BUG_CREATION=true
ENABLE_PR_CREATION=false
```

### Azure DevOps Integration

```env
AI_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

BUG_TRACKER_PROVIDER=azure-devops
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PROJECT=YourProject
AZURE_DEVOPS_PAT=your-pat

PR_PROVIDER=azure-devops
# Uses same AZURE_DEVOPS_* vars

ENABLE_BUG_CREATION=true
```

### Enterprise Setup (Azure + MySQL)

```env
AI_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

DATABASE_PROVIDER=mysql
MYSQL_HOST=mysql.example.com
MYSQL_USER=testuser
MYSQL_PASSWORD=secure-password
MYSQL_DATABASE=test_results

BUG_TRACKER_PROVIDER=azure-devops
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/enterprise
AZURE_DEVOPS_PROJECT=QA

NOTIFICATION_PROVIDER=email
EMAIL_HOST=smtp.office365.com
EMAIL_USER=notifications@company.com
EMAIL_PASSWORD=app-password
EMAIL_FROM=notifications@company.com
EMAIL_TO=qa-team@company.com

ENABLE_BUG_CREATION=true
ENABLE_DATABASE_LOGGING=true
ENABLE_NOTIFICATIONS=true
```

## Running Tests

```bash
# Run Playwright tests with the reporter
npm run test:e2e

# With UI
npm run test:e2e:ui

# With debugging
npm run test:e2e:debug
```

## Workflow Example

See `src/examples/ReporterWorkflow.ts` for a complete example of:

1. Generating AI fix suggestions
2. Creating bugs for failures
3. Auto-generating PRs with fixes
4. Saving results to database
5. Sending notifications

## Troubleshooting

### Configuration Issues

Run the validator:

```bash
npm run validate:config
```

### Provider Connection Failed

Check:

1. API keys are correct
2. Endpoints are accessible
3. Network/firewall settings
4. Service status (Azure/OpenAI/etc.)

### Azure OpenAI Authentication

Ensure you're logged in with Azure CLI:

```bash
az login
```

Or Azure PowerShell:

```powershell
Connect-AzAccount
```

### Database Connection Issues

For SQLite:

- No setup needed, file created automatically

For MySQL:

- Check host, port, credentials
- Ensure database exists
- Verify network access

## Next Steps

1. ✅ Validate configuration with `npm run validate:config`
2. ✅ Run a test to verify reporter works
3. ✅ Check test-results directory for output
4. ✅ Review generated prompts and fixes
5. ✅ Configure additional providers as needed

## Documentation

- [PROVIDERS.md](./PROVIDERS.md) - Detailed provider documentation
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Architecture overview
- [examples/env-configs/](../examples/env-configs/) - Pre-configured environment files
- [examples/tests/](../examples/tests/) - Sample test files

## Support

For issues or questions:

1. Check the documentation
2. Run configuration validator
3. Review example workflow
4. Check provider-specific documentation

## License

See LICENSE file for details.
