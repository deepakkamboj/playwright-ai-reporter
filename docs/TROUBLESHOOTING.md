# Troubleshooting Guide

This guide helps you diagnose and fix common issues with Playwright Smart Reporter.

---

## Configuration Issues

### AI Fix Suggestions Not Generated

**Symptoms:**
- No fix files in `test-results/fixes/`
- No AI-related output in console

**Solutions:**

1. **Check configuration flag:**
   ```typescript
   // In playwright.config.ts
   {
       generateFix: true,  // Must be true
   }
   ```

2. **Verify AI provider is set:**
   ```bash
   # Check .env file
   AI_PROVIDER=openai  # Or mistral, anthropic, google, azure-openai
   ```

3. **Validate API key:**
   ```bash
   # For OpenAI
   echo $OPENAI_API_KEY
   
   # For Mistral
   echo $MISTRAL_API_KEY
   ```

4. **Check network connectivity:**
   ```bash
   # Test connection to AI provider
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

5. **Review console for errors:**
   Look for error messages in the test output indicating API failures.

---

### PRs Not Being Created

**Symptoms:**
- No pull requests created despite `generatePR: true`
- Error messages about git or GitHub

**Solutions:**

1. **Verify all requirements:**
   ```typescript
   {
       generateFix: true,   // Required for generatePR
       generatePR: true,
   }
   ```

2. **Check PR provider configuration:**
   ```bash
   # In .env
   PR_PROVIDER=github
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=your-org
   GITHUB_REPO=your-repo
   BASE_BRANCH=main
   ```

3. **Verify token permissions:**
   GitHub token needs:
   - `repo` scope (full control)
   - `workflow` scope (if creating PRs in repos with workflows)

4. **Check git repository status:**
   ```bash
   git status
   # Should be in a git repository with no uncommitted changes
   ```

5. **Verify branch exists:**
   ```bash
   git branch --list main
   # Target branch should exist
   ```

---

### Database Connection Errors

**Symptoms:**
- "Failed to connect to database" errors
- Test results not saved

**Solutions:**

#### SQLite Issues

1. **Check file path:**
   ```bash
   # Ensure directory exists
   mkdir -p ./data
   ```

2. **Verify permissions:**
   ```bash
   # Check write permissions
   touch ./data/test-results.db
   ```

#### MySQL Issues

1. **Test connection:**
   ```bash
   mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE
   ```

2. **Verify credentials in .env:**
   ```bash
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=test_results
   ```

3. **Check MySQL server is running:**
   ```bash
   # Windows
   Get-Service MySQL*
   
   # Linux/Mac
   sudo systemctl status mysql
   ```

4. **Create database if needed:**
   ```sql
   CREATE DATABASE IF NOT EXISTS test_results;
   ```

---

### Email Notifications Not Sent

**Symptoms:**
- No emails received
- SMTP errors in console

**Solutions:**

1. **Verify email configuration:**
   ```bash
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=true
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password  # Not regular password!
   EMAIL_FROM=your-email@gmail.com
   EMAIL_TO=recipient@example.com
   ```

2. **Use app-specific password (Gmail):**
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate new app password
   - Use that instead of regular password

3. **Test SMTP connection:**
   ```bash
   telnet smtp.gmail.com 587
   ```

4. **Check firewall/network:**
   Ensure outbound SMTP connections allowed (port 587 or 465)

---

## Runtime Errors

### "Provider not initialized"

**Error:**
```
Error: AI provider not initialized. Call ProviderRegistry.initialize() first.
```

**Solution:**

The reporter auto-initializes providers, but if using providers directly:

```typescript
import {ProviderRegistry} from 'playwright-smart-reporter';

await ProviderRegistry.initialize({
    ai: {type: 'openai'},
});

const provider = await ProviderRegistry.getAIProvider();
```

---

### "Invalid API key"

**Error:**
```
Error: 401 Unauthorized - Invalid API key
```

**Solutions:**

1. **Check API key format:**
   - OpenAI: Starts with `sk-`
   - Anthropic: Starts with `sk-ant-`
   - Mistral: Alphanumeric string
   - Google AI: Alphanumeric string

2. **Verify key is active:**
   - Check provider dashboard
   - Ensure key hasn't been revoked
   - Check billing/quota limits

3. **Check for extra spaces:**
   ```bash
   # Remove quotes and trim
   OPENAI_API_KEY=sk-abc123...  # No quotes, no spaces
   ```

---

### "Rate limit exceeded"

**Error:**
```
Error: 429 Too Many Requests - Rate limit exceeded
```

**Solutions:**

1. **Reduce concurrent test runs**
2. **Add retry logic** (built-in for most providers)
3. **Upgrade API plan** if needed
4. **Switch to different AI provider** temporarily

---

## Build/Compilation Issues

### TypeScript Compilation Errors

See [BUILD_FIXES.md](./BUILD_FIXES.md) for detailed TypeScript troubleshooting.

Common fixes:

1. **Update TypeScript:**
   ```bash
   npm install typescript@latest --save-dev
   ```

2. **Clear build cache:**
   ```bash
   rm -rf dist/
   npm run build
   ```

3. **Check peer dependencies:**
   ```bash
   npm install
   ```

---

## CI/CD Issues

### Tests Pass Locally but Fail in CI

**Solutions:**

1. **Check environment variables:**
   - Verify all secrets are set in CI
   - Check variable names match exactly

2. **Verify dependencies installed:**
   ```yaml
   # In GitHub Actions
   - name: Install dependencies
     run: npm ci  # Use ci instead of install
   ```

3. **Check Node.js version:**
   ```yaml
   # Ensure same version as local
   - uses: actions/setup-node@v3
     with:
       node-version: '18'  # Match your local version
   ```

4. **Enable debug logging:**
   ```bash
   DEBUG=playwright:* npx playwright test
   ```

---

### GitHub Actions Permissions

**Error:**
```
Error: Resource not accessible by integration
```

**Solution:**

Update workflow permissions:

```yaml
# .github/workflows/test.yml
permissions:
  contents: write  # For PR creation
  issues: write    # For bug creation
  pull-requests: write
```

---

## Provider-Specific Issues

### Azure OpenAI

**"Deployment not found" Error:**

```bash
# Check deployment name matches exactly
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4  # Must match Azure deployment
```

**Managed Identity Issues:**

1. **Verify identity assigned:**
   ```bash
   az identity show --name your-identity --resource-group your-rg
   ```

2. **Check role assignments:**
   ```bash
   az role assignment list --assignee <identity-principal-id>
   ```

---

### GitHub Issues/PRs

**"Not Found" Error:**

1. **Check org/repo names:**
   ```bash
   GITHUB_OWNER=your-org  # Not username if using org
   GITHUB_REPO=your-repo  # Exact repo name
   ```

2. **Verify token permissions:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Ensure `repo` scope is enabled

---

### Jira

**Authentication Failures:**

1. **Use API token, not password:**
   - Go to Jira → Account settings → Security → API tokens
   - Create new token
   - Use email + API token (not password)

2. **Check Jira Cloud vs Server:**
   ```bash
   # Cloud
   JIRA_HOST=your-domain.atlassian.net
   
   # Server
   JIRA_HOST=jira.your-company.com
   ```

---

## Performance Issues

### Tests Running Slowly

**Solutions:**

1. **Disable unnecessary features:**
   ```typescript
   {
       generateFix: false,  // Disable if not needed
       publishToDB: false,
       sendEmail: false,
   }
   ```

2. **Reduce AI API calls:**
   - Only generate fixes for true failures (not retries)
   - Use faster AI models (GPT-3.5 vs GPT-4)

3. **Optimize database:**
   - Use SQLite for local/small-scale
   - Add indexes if using custom queries

---

### Memory Issues

**Solutions:**

1. **Limit test parallelism:**
   ```typescript
   // playwright.config.ts
   export default defineConfig({
       workers: 2,  // Reduce from default
   });
   ```

2. **Clean up old results:**
   ```bash
   rm -rf test-results/fixes/*
   rm -rf test-results/prompts/*
   ```

---

## Validation

### Run Configuration Validator

```bash
npm run validate:config
```

This checks:
- Environment variables
- API keys validity
- Provider connectivity
- Configuration completeness

---

## Debug Mode

Enable detailed logging:

```typescript
// playwright.config.ts
export default defineConfig({
    reporter: [
        [
            'playwright-smart-reporter',
            {
                debug: true,  // Enable verbose logging
                // ... other options
            },
        ],
    ],
});
```

Or set environment variable:

```bash
DEBUG=playwright-smart-reporter:* npx playwright test
```

---

## Getting Help

If you're still stuck:

1. **Check existing issues:**
   [GitHub Issues](https://github.com/deepakkamboj/playwright-smart-reporter/issues)

2. **Search discussions:**
   [GitHub Discussions](https://github.com/deepakkamboj/playwright-smart-reporter/discussions)

3. **Create new issue:**
   Include:
   - Configuration (sanitized, no API keys)
   - Error messages
   - Steps to reproduce
   - Environment (Node version, OS, etc.)

4. **Email support:**
   support@playwright-smart-reporter.dev

---

## Common Error Messages

| Error Message                       | Likely Cause                    | Fix                                   |
| ----------------------------------- | ------------------------------- | ------------------------------------- |
| `Provider not initialized`          | Missing initialization          | Call `ProviderRegistry.initialize()`  |
| `Invalid API key`                   | Wrong/expired key               | Check API key in provider dashboard   |
| `Rate limit exceeded`               | Too many requests               | Wait or upgrade API plan              |
| `ECONNREFUSED`                      | Service not running             | Start database/service                |
| `Permission denied`                 | Insufficient permissions        | Check token scopes                    |
| `Resource not accessible`           | CI permissions                  | Update workflow permissions           |
| `Deployment not found`              | Wrong deployment name           | Check Azure OpenAI deployment         |
| `Network error`                     | Connectivity issue              | Check firewall/network                |
| `Authentication failed`             | Invalid credentials             | Verify username/password/token        |
| `Branch already exists`             | Leftover from previous run      | Delete branch or use different name   |

---

## Best Practices to Avoid Issues

1. **Always use environment variables** for sensitive data
2. **Validate configuration** before running tests (`npm run validate:config`)
3. **Test locally first** before deploying to CI
4. **Use draft PRs** to review AI fixes before merging
5. **Monitor API usage** and costs
6. **Keep dependencies updated** (`npm update`)
7. **Review logs** after test runs for warnings
8. **Start with minimal config** and add features gradually

---

For more help, see:
- [Quick Start Guide](./QUICKSTART.md)
- [Environment Configuration](./ENV_CONFIG_GUIDE.md)
- [Provider Documentation](./PROVIDERS.md)
