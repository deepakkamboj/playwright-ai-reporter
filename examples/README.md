# Examples

This folder contains example configurations and test files to help you get started with **Playwright Smart Reporter**.

---

## 📁 Folder Structure

```
examples/
├── env-configs/          # Pre-configured environment files
│   ├── .env.github-stack
│   ├── .env.azure-stack
│   ├── .env.openai-jira
│   ├── .env.anthropic-minimal
│   ├── .env.google-mysql
│   └── .env.example
├── tests/               # Sample test files
    ├── google-search.test.ts
    ├── mixed-results.test.ts
    └── playwright-site.test.ts
├── playwright.config.ts # Example Playwright configuration
└── package.json        # Example dependencies and scripts
```

---

## 🚀 Getting Started

### 1. Install Dependencies

From the examples folder:

```bash
cd examples
npm install
```

This will install:
- `@playwright/test` - Playwright testing framework
- `playwright-ai-reporter` - The smart reporter (linked from parent)
- `dotenv` - Environment variable management

---

## 🔧 Environment Configurations

### Available Stacks

#### 1. **GitHub Stack** (`.env.github-stack`)
**Best for:** Open source projects, small teams

**Includes:**
- **AI:** Mistral AI (cost-effective)
- **Bug Tracker:** GitHub Issues
- **Database:** SQLite (file-based)
- **PR Provider:** GitHub

**Setup:**
```bash
cp examples/env-configs/.env.github-stack .env
# Edit .env with your credentials
```

---

#### 2. **Azure Stack** (`.env.azure-stack`)
**Best for:** Enterprise, Microsoft-centric organizations

**Includes:**
- **AI:** Azure OpenAI (with Managed Identity support)
- **Bug Tracker:** Azure DevOps Work Items
- **Database:** MySQL
- **PR Provider:** Azure DevOps

**Setup:**
```bash
cp examples/env-configs/.env.azure-stack .env
# Edit .env with your credentials
```

---

#### 3. **OpenAI + Jira** (`.env.openai-jira`)
**Best for:** Startups, agile teams using Jira

**Includes:**
- **AI:** OpenAI (GPT-4)
- **Bug Tracker:** Jira
- **Database:** SQLite
- **PR Provider:** GitHub

**Setup:**
```bash
cp examples/env-configs/.env.openai-jira .env
# Edit .env with your credentials
```

---

#### 4. **Anthropic Minimal** (`.env.anthropic-minimal`)
**Best for:** Local development, minimal setup

**Includes:**
- **AI:** Anthropic Claude (high quality)
- **Database:** SQLite
- **No bug tracker or PR provider**

**Setup:**
```bash
cp examples/env-configs/.env.anthropic-minimal .env
# Edit .env with your API key
```

---

#### 5. **Google + MySQL** (`.env.google-mysql`)
**Best for:** Cost-conscious teams, high token limits

**Includes:**
- **AI:** Google Gemini
- **Bug Tracker:** GitHub Issues
- **Database:** MySQL
- **PR Provider:** GitHub

**Setup:**
```bash
cp examples/env-configs/.env.google-mysql .env
# Edit .env with your credentials
```

---

## 📝 Test Examples

### `google-search.test.ts`
Simple Google search test demonstrating basic Playwright usage.

```bash
npx playwright test examples/tests/google-search.test.ts
```

---

### `mixed-results.test.ts`
Demonstrates various test outcomes (pass, fail, skip) to show reporter capabilities.

```bash
npx playwright test examples/tests/mixed-results.test.ts
```

---

### `playwright-site.test.ts`
Tests the official Playwright website with multiple scenarios.

```bash
npx playwright test examples/tests/playwright-site.test.ts
```

---



## 🚀 Quick Start

### 2. Choose Your Stack

Select an environment configuration based on your needs:

```bash
# For open source projects
cp env-configs/.env.github-stack ../.env

# For enterprise
cp env-configs/.env.azure-stack ../.env

# For minimal setup
cp env-configs/.env.anthropic-minimal ../.env
```

### 3. Configure Credentials

Edit `../.env` (in project root) with your API keys and settings:

```env
# AI Provider
AI_PROVIDER=mistral
MISTRAL_API_KEY=your-api-key-here

# Bug Tracker (optional)
BUG_TRACKER_PROVIDER=github
GITHUB_TOKEN=ghp_your_token
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo

# Database (optional)
DATABASE_PROVIDER=sqlite
SQLITE_DATABASE_PATH=./data/test-results.db
```

### 3. Update Playwright Config

Add the reporter to your `playwright.config.ts`:

```typescript
import {defineConfig} from '@playwright/test';

export default defineConfig({
    reporter: [
        ['list'],
        [
            'playwright-ai-reporter',
            {
                generateFix: true,
                createBug: false,
                generatePR: false,
                publishToDB: false,
            },
        ],
    ],
});
```

### 4. Run Example Tests

```bash
# From examples folder
npm test                    # Run all tests
npm run test:ui            # Run with UI mode
npm run test:debug         # Run in debug mode

# Run specific tests
npm run test:google        # Google search test
npm run test:mixed         # Mixed results test
npm run test:playwright    # Playwright site test
```

---

## 📊 What to Expect

After running tests, you'll see:

### Console Output
- ✅ Passed tests with duration
- ❌ Failed tests with categorized errors
- 🔄 Retry attempts
- 📊 Test metrics and statistics
- 🎯 Slowest tests
- 🏗️ Build information (in CI)

### Generated Files
```
test-results/
├── testSummary.json          # Complete test run summary
├── testFailures.json         # Detailed failure information
├── .last-run.json           # Previous run for comparison
├── prompts/                 # AI prompts (if generateFix=true)
│   └── test-name.md
└── fixes/                   # AI-generated fixes (if generateFix=true)
    └── fix-test-name.md
```

### Optional Integrations
- **Bug tracker** - Issues/tickets created automatically (if `createBug=true`)
- **Pull requests** - Draft PRs with AI fixes (if `generatePR=true`)
- **Database** - Test results stored for analysis (if `publishToDB=true`)
- **Email** - Notifications sent to team (if `sendEmail=true`)

---

## 🔗 Additional Resources

- **[Quick Start Guide](../docs/QUICKSTART.md)** - Detailed setup instructions
- **[Environment Configuration Guide](../docs/ENV_CONFIG_GUIDE.md)** - Complete configuration reference
- **[Provider Documentation](../docs/PROVIDERS.md)** - Provider-specific setup
- **[Troubleshooting](../docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Reference](../docs/API.md)** - Complete API documentation

---

## 💡 Tips

1. **Start simple** - Use `.env.anthropic-minimal` for local development
2. **Validate config** - Run `npm run validate:config` before tests
3. **Review AI fixes** - Always review generated fixes before applying
4. **Use draft PRs** - Enable `generatePR: true` with `isDraft: true` for safety
5. **Monitor costs** - Track AI API usage, especially with GPT-4
6. **Test locally first** - Validate setup before deploying to CI/CD

---

## 🤝 Contributing

Have a useful example configuration or test? We'd love to include it!

1. Create your example in the appropriate folder
2. Add documentation
3. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

**Need help?** Check the [documentation](../docs/README.md) or [open an issue](https://github.com/deepakkamboj/playwright-ai-reporter/issues).

