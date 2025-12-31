# Environment Configuration Guide

This guide explains the pre-configured environment files available in `examples/env-configs/`. Choose the configuration that best matches your infrastructure and copy it to `.env` in the project root.

## Available Configurations

### 1. `.env.github-stack` (Recommended for GitHub Users)

**Stack**: GitHub + Mistral AI + Email + SQLite

**Best for**:

- Open source projects hosted on GitHub
- Teams already using GitHub Issues and Pull Requests
- Quick local setup with minimal infrastructure

**Setup**:

```bash
cp examples/env-configs/.env.github-stack .env
```

**What you need**:

- GitHub Personal Access Token (with `repo` scope)
- Mistral AI API key
- Gmail account with App Password (for notifications)

---

### 2. `.env.azure-stack` (Recommended for Azure Users)

**Stack**: Azure DevOps + Azure OpenAI + Email + MySQL

**Best for**:

- Enterprise projects on Azure DevOps
- Teams using Azure cloud infrastructure
- Production environments with managed identity

**Setup**:

```bash
cp examples/env-configs/.env.azure-stack .env
```

**What you need**:

- Azure DevOps Personal Access Token (with Work Items, Code scope)
- Azure OpenAI deployment (or use Managed Identity)
- Azure MySQL or any MySQL server
- Office 365 email account

---

### 3. `.env.openai-jira` (Hybrid Configuration)

**Stack**: Jira + GitHub + OpenAI + Email + SQLite

**Best for**:

- Teams using Jira for issue tracking
- Code hosted on GitHub
- Hybrid tool environments

**Setup**:

```bash
cp examples/env-configs/.env.openai-jira .env
```

**What you need**:

- Jira Cloud account with API token
- GitHub Personal Access Token (for PRs)
- OpenAI API key
- SendGrid or SMTP email service

---

### 4. `.env.anthropic-minimal` (Minimal Configuration)

**Stack**: Anthropic Claude + SQLite only

**Best for**:

- Local development and testing
- Evaluating AI analysis capabilities
- No external integrations needed

**Setup**:

```bash
cp examples/env-configs/.env.anthropic-minimal .env
```

**What you need**:

- Anthropic API key (Claude)
- Nothing else - fully local!

---

### 5. `.env.google-mysql` (Google Cloud Configuration)

**Stack**: GitHub + Google Gemini + Email + MySQL

**Best for**:

- Projects using Google Cloud Platform
- Teams wanting to try Google's Gemini AI
- Cloud-based database storage

**Setup**:

```bash
cp examples/env-configs/.env.google-mysql .env
```

**What you need**:

- Google AI API key (Gemini)
- GitHub Personal Access Token
- Google Cloud SQL MySQL or any MySQL server
- Gmail account with App Password

---

## Configuration Steps

### Step 1: Choose Your Stack

Select the configuration that matches your infrastructure and copy it to `.env`:

```bash
# Example: Using GitHub stack
cp examples/env-configs/.env.github-stack .env
```

### Step 2: Update Credentials

Edit the `.env` file and replace all placeholder values:

```bash
# Windows
notepad .env

# macOS/Linux
nano .env
```

### Step 3: Verify Configuration

Test your configuration:

```bash
npm run validate-config
```

### Step 4: Run Tests

Your reporter will automatically use the provider configuration:

```bash
npx playwright test
```

---

## Provider-Specific Setup Instructions

### GitHub Configuration

1. Create a Personal Access Token:

    - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
    - Generate new token with `repo` scope
    - Copy token to `GITHUB_TOKEN`

2. Set repository details:
    ```env
    GITHUB_OWNER=your-username-or-org
    GITHUB_REPO=your-repository-name
    ```

### Azure DevOps Configuration

1. Create a Personal Access Token:

    - Go to User Settings → Personal access tokens
    - Create token with `Work Items (Read, write)` and `Code (Read, write)` scopes
    - Copy token to `AZURE_DEVOPS_PAT`

2. Set organization and project:
    ```env
    AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
    AZURE_DEVOPS_PROJECT=YourProject
    ```

### Jira Configuration

1. Create an API token:

    - Go to https://id.atlassian.com/manage/api-tokens
    - Create API token
    - Copy token to `JIRA_API_TOKEN`

2. Set your Jira details:
    ```env
    JIRA_HOST=https://your-company.atlassian.net
    JIRA_EMAIL=your-email@company.com
    JIRA_PROJECT_KEY=QA
    ```

### AI Provider Setup

#### Mistral AI

1. Get API key from https://console.mistral.ai/
2. Set in `.env`:
    ```env
    MISTRAL_API_KEY=your-key-here
    ```

#### Azure OpenAI

1. Create Azure OpenAI resource
2. Deploy a model (e.g., gpt-4)
3. Set configuration:
    ```env
    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
    AZURE_OPENAI_DEPLOYMENT=gpt-4
    AZURE_OPENAI_API_KEY=your-key-here
    ```

#### OpenAI

1. Get API key from https://platform.openai.com/api-keys
2. Set in `.env`:
    ```env
    OPENAI_API_KEY=sk-your-key-here
    ```

#### Anthropic (Claude)

1. Get API key from https://console.anthropic.com/
2. Set in `.env`:
    ```env
    ANTHROPIC_API_KEY=sk-ant-your-key-here
    ```

#### Google AI (Gemini)

1. Get API key from https://makersuite.google.com/app/apikey
2. Set in `.env`:
    ```env
    GOOGLE_AI_API_KEY=your-key-here
    ```

### Email Configuration

#### Gmail

1. Enable 2-factor authentication
2. Create App Password: https://myaccount.google.com/apppasswords
3. Set configuration:
    ```env
    EMAIL_HOST=smtp.gmail.com
    EMAIL_PORT=587
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASSWORD=your-16-char-app-password
    ```

#### Office 365

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@company.com
EMAIL_PASSWORD=your-password
```

#### SendGrid

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### Database Configuration

#### SQLite (Local - No Setup Required)

```env
DATABASE_PROVIDER=sqlite
SQLITE_DATABASE_PATH=./data/test-results.db
```

#### MySQL

```env
DATABASE_PROVIDER=mysql
MYSQL_HOST=your-server.com
MYSQL_PORT=3306
MYSQL_USER=username
MYSQL_PASSWORD=password
MYSQL_DATABASE=test_results
```

---

## Feature Flags

Control which features are enabled:

```env
# Enable/disable bug creation
ENABLE_BUG_CREATION=true

# Enable/disable auto-fix PR generation
ENABLE_PR_CREATION=true

# Enable/disable database logging
ENABLE_DATABASE_LOGGING=true

# Enable/disable email notifications
ENABLE_NOTIFICATIONS=true
```

---

## Environment Metadata

Add context to your test runs:

```env
# Environment name (local, dev, staging, production)
TEST_ENVIRONMENT=staging

# Git branch name
BRANCH_NAME=main

# Git commit hash (auto-populated by CI/CD)
COMMIT_HASH=abc123def456
```

---

## Security Best Practices

1. **Never commit `.env` to version control**

    - `.env` is in `.gitignore` by default
    - Only commit `.env.example` or `.env.*-stack` templates

2. **Use environment-specific files**

    - Use different `.env` files for local vs CI/CD
    - Keep production credentials separate

3. **Rotate credentials regularly**

    - Update API keys and tokens periodically
    - Revoke unused tokens

4. **Use managed identities in production**
    - For Azure: Enable `AZURE_USE_MANAGED_IDENTITY=true`
    - Avoid hardcoding credentials in production

---

## Troubleshooting

### Configuration Validation Errors

Run the validation script to check your configuration:

```bash
npm run validate-config
```

### Provider Connection Issues

Test individual providers:

```bash
# Test AI provider
node -e "require('./dist/src/providers/ProviderRegistry').ProviderRegistry.getAIProvider().then(p => p.testConnection())"

# Test bug tracker
node -e "require('./dist/src/providers/ProviderRegistry').ProviderRegistry.getBugTrackerProvider().then(p => console.log('Connected'))"
```

### Common Issues

1. **GitHub token permissions**: Ensure token has `repo` scope
2. **Azure DevOps PAT**: Needs `Work Items` and `Code` scopes
3. **Email authentication**: Use App Passwords for Gmail, not regular password
4. **Database connection**: Ensure database exists and credentials are correct

---

## Examples

### Full GitHub Stack Setup

```bash
# 1. Copy template
cp examples/env-configs/.env.github-stack .env

# 2. Edit .env and set:
# - GITHUB_TOKEN=ghp_xxx
# - GITHUB_OWNER=myorg
# - GITHUB_REPO=myrepo
# - MISTRAL_API_KEY=xxx
# - EMAIL_USER=me@gmail.com
# - EMAIL_PASSWORD=my-app-password

# 3. Run tests
npx playwright test
```

### Minimal Local Testing

```bash
# 1. Copy minimal template
cp examples/env-configs/.env.anthropic-minimal .env

# 2. Edit .env and set only:
# - ANTHROPIC_API_KEY=sk-ant-xxx

# 3. Run tests
npx playwright test
```

---

## Need Help?

- 📖 See [PROVIDERS.md](./PROVIDERS.md) for provider documentation
- 🚀 See [QUICKSTART.md](./QUICKSTART.md) for quick setup guide
- 📋 See [README.md](./README.md) for full documentation
