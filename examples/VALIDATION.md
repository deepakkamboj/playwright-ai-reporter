# Validate Configuration Script

This script helps validate your environment configuration before running tests.

## Usage

```bash
# From examples folder
npm run validate:config
```

## What it checks

1. ✅ Environment variables are set
2. ✅ AI provider is configured correctly
3. ✅ Optional providers are configured (if enabled)
4. ✅ Required files exist
5. ✅ API keys format validation

## Quick Validation

You can also manually check your `.env` file:

### Required (Minimum)
- `AI_PROVIDER` - Must be set to one of: `openai`, `azure-openai`, `anthropic`, `google`, `mistral`
- Corresponding API key for your chosen provider

### Optional
- `BUG_TRACKER_PROVIDER` - If you want bug creation
- `DATABASE_PROVIDER` - If you want to store results
- `PR_PROVIDER` - If you want auto-PR generation
- `EMAIL_*` - If you want email notifications

## Common Issues

### "AI provider not configured"
- Check `AI_PROVIDER` is set in `.env`
- Ensure the corresponding API key is set

### "Invalid API key format"
- OpenAI keys start with `sk-`
- Anthropic keys start with `sk-ant-`
- Check for extra spaces or quotes

### "Provider connection failed"
- Verify API key is valid
- Check network connectivity
- Ensure you have credits/quota remaining

## Example Configurations

See `env-configs/` folder for complete working examples:
- `.env.github-stack` - GitHub + Mistral AI
- `.env.azure-stack` - Azure DevOps + Azure OpenAI
- `.env.anthropic-minimal` - Minimal Claude setup

## Support

For detailed configuration help, see:
- [Environment Configuration Guide](../docs/ENV_CONFIG_GUIDE.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
