# CLAUDE.MD - Project Context for AI Assistants

> **For AI assistants working with this codebase**
> This document provides comprehensive context about the Playwright AI Reporter project to help AI assistants understand the codebase structure, architecture, and conventions.

## Project Overview

**Playwright AI Reporter** is an enterprise-grade, AI-powered test reporter for Playwright that transforms test failures into actionable insights with automated workflows. It's a production-ready NPM package designed for CI/CD pipelines and enterprise test automation.

### Core Purpose

- **Analyze test failures** automatically using AI to generate intelligent fix suggestions
- **Create bugs/issues** in bug tracking systems (GitHub, Azure DevOps, Jira)
- **Generate pull requests** with AI-suggested fixes for auto-healing tests
- **Store test results** in databases for historical analysis and trend detection
- **Send notifications** about test results via email and other channels
- **Provide rich console output** with comprehensive test metrics

### Key Metadata

- **Package Name**: `playwright-ai-reporter`
- **Version**: `0.0.1`
- **Author**: Deepak Kamboj
- **License**: MIT
- **Language**: TypeScript 5.7+
- **Runtime**: Node.js 18+
- **Repository**: https://github.com/deepakkamboj/playwright-ai-reporter

## Project Structure

```
e:\git\playwright-ai-reporter\
├── src/                          # Source code (TypeScript)
│   ├── reporter.ts               # Main entry point (965 lines)
│   ├── colors.ts                 # ANSI color codes for console output
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts              # All type exports
│   ├── providers/                # Provider-based architecture
│   │   ├── ProviderRegistry.ts   # Centralized provider management (singleton)
│   │   ├── interfaces/           # Provider interfaces
│   │   │   ├── IAIProvider.ts
│   │   │   ├── IBugTrackerProvider.ts
│   │   │   ├── IDatabaseProvider.ts
│   │   │   ├── INotificationProvider.ts
│   │   │   └── IPRProvider.ts
│   │   ├── ai/                   # AI provider implementations
│   │   │   ├── AzureOpenAIProvider.ts
│   │   │   ├── OpenAIProvider.ts
│   │   │   ├── AnthropicProvider.ts
│   │   │   ├── GoogleAIProvider.ts
│   │   │   └── MistralProvider.ts
│   │   ├── bugTrackers/          # Bug tracker integrations
│   │   │   ├── GitHubIssueProvider.ts
│   │   │   ├── AzureDevOpsProvider.ts
│   │   │   └── JiraProvider.ts
│   │   ├── databases/            # Database providers
│   │   │   ├── SQLiteProvider.ts
│   │   │   └── MySQLProvider.ts
│   │   ├── notifications/        # Notification providers
│   │   │   └── EmailProvider.ts
│   │   ├── pr/                   # PR providers
│   │   │   ├── GitHubPRProvider.ts
│   │   │   └── AzureDevOpsPRProvider.ts
│   │   └── factories/            # Factory classes
│   │       ├── AIProviderFactory.ts
│   │       ├── BugTrackerFactory.ts
│   │       ├── DatabaseFactory.ts
│   │       ├── NotificationFactory.ts
│   │       └── PRFactory.ts
│   ├── utils/                    # Utility functions
│   │   ├── genaiUtils.ts         # AI integration logic
│   │   ├── fileHandlerUtils.ts   # File I/O operations
│   │   ├── buildInfoUtils.ts     # CI/CD metadata extraction
│   │   ├── historyUtils.ts       # Test history tracking
│   │   ├── configValidator.ts    # Configuration validation
│   │   └── utils.ts              # General utilities (logging, metrics)
│   └── examples/                 # Code examples
│       └── ReporterWorkflow.ts   # Complete workflow example
├── docs/                         # Comprehensive documentation
│   ├── README.md                 # Documentation hub
│   ├── QUICKSTART.md             # Quick start guide
│   ├── ENV_CONFIG_GUIDE.md       # Environment configuration
│   ├── PROVIDERS.md              # Provider documentation
│   ├── design.md                 # Architecture & design
│   ├── IMPLEMENTATION_SUMMARY.md # Implementation details
│   ├── API.md                    # API reference
│   └── TROUBLESHOOTING.md        # Common issues
├── examples/                     # Example configurations
│   ├── env-configs/              # Pre-configured .env files
│   │   ├── .env.github-stack     # GitHub + Mistral AI + SQLite
│   │   ├── .env.azure-stack      # Azure DevOps + Azure OpenAI + MySQL
│   │   ├── .env.openai-jira      # Jira + OpenAI + SQLite
│   │   └── .env.anthropic-minimal # Claude AI only
│   ├── tests/                    # Sample test files
│   └── playwright.config.ts      # Example configuration
├── dist/                         # Compiled JavaScript output
├── package.json                  # NPM package configuration
├── tsconfig.json                 # TypeScript configuration
├── .eslintrc.cjs                 # ESLint configuration
├── .prettierrc                   # Prettier configuration
└── README.md                     # Main documentation

```

## Architecture

### Design Patterns

1. **Provider Pattern** - Pluggable integrations for AI, bug trackers, databases, notifications, and PR generation
2. **Factory Pattern** - Clean provider instantiation via factory classes
3. **Singleton Pattern** - Centralized ProviderRegistry for provider management
4. **Strategy Pattern** - Swappable AI providers and bug trackers

### Key Architectural Principles

- **Provider Independence** - No vendor lock-in; easily swap providers
- **Lazy Initialization** - Resources loaded only when needed
- **Type Safety** - Full TypeScript support with strict mode
- **Testability** - Easy mocking for unit tests
- **Modularity** - Import only what you need

### Test Failure Workflow

1. Test fails → Reporter captures failure details
2. Error categorization and analysis (Timeout, Selector, Network, etc.)
3. AI generates fix suggestion (optional, if `generateFix: true`)
4. Create bug in tracker (optional, if `createBug: true`)
5. Generate PR with fix (optional, if `generatePR: true`)
6. Store in database (optional, if `publishToDB: true`)
7. Send notifications (optional, if `sendEmail: true`)

## Core Components

### Main Entry Point: `src/reporter.ts`

The main reporter class implementing Playwright's Reporter interface. It orchestrates:
- Test lifecycle event handling
- Provider coordination
- Console output generation
- Metrics calculation
- Workflow orchestration

### Provider Registry: `src/providers/ProviderRegistry.ts`

Centralized singleton for managing all providers:
- Lazy initialization of providers
- Configuration management
- Provider lifecycle management
- Factory delegation

### Provider Interfaces

Five core provider types:
1. **IAIProvider** - AI completion generation
2. **IBugTrackerProvider** - Bug/issue creation
3. **IDatabaseProvider** - Test result storage
4. **INotificationProvider** - Alert delivery
5. **IPRProvider** - Pull request creation

### Utility Modules

- **genaiUtils.ts** - AI integration, prompt generation, fix suggestion creation
- **fileHandlerUtils.ts** - File I/O, test source extraction
- **buildInfoUtils.ts** - CI/CD metadata (GitHub Actions, Azure Pipelines, Jenkins)
- **historyUtils.ts** - Test history tracking and comparison
- **configValidator.ts** - Configuration validation and sanity checks
- **utils.ts** - Logging, metrics, formatting utilities

## Supported Providers

### AI Providers (5)

| Provider | Configuration | Status |
|----------|--------------|--------|
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` | ✅ Production Ready |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` | ✅ Production Ready |
| Anthropic Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | ✅ Production Ready |
| Google AI (Gemini) | `GOOGLE_AI_API_KEY`, `GOOGLE_AI_MODEL` | ✅ Production Ready |
| Mistral AI | `MISTRAL_API_KEY`, `MISTRAL_MODEL` | ✅ Production Ready |

### Bug Trackers (3)

| Provider | Configuration | Status |
|----------|--------------|--------|
| GitHub Issues | `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` | ✅ Production Ready |
| Azure DevOps | `AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` | ✅ Production Ready |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` | ✅ Production Ready |

### Databases (2)

| Provider | Configuration | Status |
|----------|--------------|--------|
| SQLite | `SQLITE_DB_PATH` (optional) | ✅ Production Ready |
| MySQL | `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | ✅ Production Ready |

### Notifications (1)

| Provider | Configuration | Status |
|----------|--------------|--------|
| Email (SMTP) | `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_TO` | ✅ Production Ready |

### PR Providers (2)

| Provider | Configuration | Status |
|----------|--------------|--------|
| GitHub | Uses `GITHUB_*` configuration | ✅ Production Ready |
| Azure DevOps | Uses `AZURE_DEVOPS_*` configuration | ✅ Production Ready |

## Configuration

### Reporter Options

```typescript
{
  slowTestThreshold: 5,        // Seconds - tests slower are flagged
  maxSlowTestsToShow: 3,       // Number of slowest tests to display
  timeoutWarningThreshold: 30, // Seconds - timeout warning threshold
  showStackTrace: true,        // Include stack traces in output
  outputDir: './test-results',  // Output directory
  generateFix: false,          // AI fix suggestions
  createBug: false,            // Auto-create bugs
  generatePR: false,           // Auto-create PRs (requires generateFix)
  publishToDB: false,          // Database storage
  sendEmail: false             // Email notifications
}
```

### Environment Variables

All configuration is done via environment variables. See `examples/env-configs/` for complete examples:
- `.env.github-stack` - GitHub + Mistral AI + SQLite
- `.env.azure-stack` - Azure DevOps + Azure OpenAI + MySQL
- `.env.openai-jira` - Jira + OpenAI + SQLite
- `.env.anthropic-minimal` - Claude AI only

## Technology Stack

### Core Technologies

- **TypeScript 5.7+** - Primary language with strict type checking
- **Node.js 18+** - Runtime environment
- **Playwright 1.51+** - Test framework integration

### Key Dependencies

- `@azure/identity` - Azure authentication and Managed Identity
- `@octokit/rest` - GitHub API integration
- `azure-devops-node-api` - Azure DevOps integration
- `axios` - HTTP client for AI APIs
- `mysql2` - MySQL database support
- `sqlite3` / `sqlite` - SQLite database support
- `nodemailer` - Email notifications
- `dotenv` - Environment variable management

### Development Tools

- **ESLint** + **TypeScript ESLint** - Code quality and linting
- **Prettier** - Code formatting
- **TypeScript Compiler** - Build process

## Build and Development

### Build Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run lint           # Run ESLint and Prettier
npm run lint:eslint    # ESLint only
npm run lint:prettier  # Prettier only
npm run validate:config # Validate configuration (removed - use examples)
```

### TypeScript Configuration

- **Target**: ES2020
- **Module**: CommonJS
- **Strict Mode**: Enabled
- **Output Directory**: `dist/`
- **Source Map**: Enabled
- **Includes**: `src/`, `tests/`

### File Naming Conventions

- **Provider files**: `{ProviderName}Provider.ts` (e.g., `OpenAIProvider.ts`)
- **Interface files**: `I{ProviderType}Provider.ts` (e.g., `IAIProvider.ts`)
- **Factory files**: `{ProviderType}Factory.ts` (e.g., `AIProviderFactory.ts`)
- **Utility files**: `{purpose}Utils.ts` (e.g., `genaiUtils.ts`)

## Code Style and Conventions

### TypeScript Style

- Use **strict TypeScript** with all strict checks enabled
- Prefer **interfaces** over types for provider contracts
- Use **async/await** for asynchronous operations
- Export types and interfaces explicitly
- Document complex logic with JSDoc comments

### Naming Conventions

- **Classes**: PascalCase (e.g., `ProviderRegistry`, `OpenAIProvider`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IAIProvider`)
- **Functions**: camelCase (e.g., `generateCompletion`, `createBug`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Private members**: Prefix with `_` (e.g., `_initialized`)

### Code Organization

1. Imports (grouped: external, internal, types)
2. Type definitions and interfaces
3. Class definition
4. Constructor
5. Public methods
6. Private methods
7. Static methods

### Error Handling

- Use try-catch blocks for external API calls
- Log errors with context information
- Provide meaningful error messages
- Fall back gracefully when providers are unavailable

## Common Tasks

### Adding a New AI Provider

1. Create interface implementation in `src/providers/ai/{ProviderName}Provider.ts`
2. Implement `IAIProvider` interface
3. Add factory method in `src/providers/factories/AIProviderFactory.ts`
4. Add configuration validation in `src/utils/configValidator.ts`
5. Add example configuration in `examples/env-configs/`
6. Update documentation in `docs/PROVIDERS.md`

### Adding a New Bug Tracker

1. Create interface implementation in `src/providers/bugTrackers/{TrackerName}Provider.ts`
2. Implement `IBugTrackerProvider` interface
3. Add factory method in `src/providers/factories/BugTrackerFactory.ts`
4. Add configuration validation
5. Add example configuration
6. Update documentation

### Adding a New Database

1. Create interface implementation in `src/providers/databases/{DatabaseName}Provider.ts`
2. Implement `IDatabaseProvider` interface
3. Add factory method in `src/providers/factories/DatabaseFactory.ts`
4. Add schema initialization logic
5. Add configuration validation
6. Update documentation

## Important Files and Their Purposes

### Critical Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/reporter.ts` | Main Playwright Reporter implementation | ~965 |
| `src/providers/ProviderRegistry.ts` | Centralized provider management | ~300 |
| `src/utils/genaiUtils.ts` | AI integration and fix generation | ~400 |
| `src/types/index.ts` | All TypeScript type definitions | ~200 |

### Configuration Files

- `.env` - Environment variables (not committed)
- `playwright.config.ts` - Playwright configuration with reporter
- `tsconfig.json` - TypeScript compiler configuration
- `.eslintrc.cjs` - ESLint configuration
- `.prettierrc` - Prettier configuration

### Documentation Files

- `README.md` - Main documentation (1184 lines)
- `docs/README.md` - Documentation hub
- `docs/QUICKSTART.md` - Quick start guide
- `docs/PROVIDERS.md` - Provider documentation
- `docs/ENV_CONFIG_GUIDE.md` - Environment configuration guide

## Testing and Examples

### Example Tests

Located in `examples/tests/`:
- Sample Playwright tests demonstrating reporter usage
- Tests for different failure scenarios
- CI/CD integration examples

### Example Configurations

Located in `examples/env-configs/`:
- Pre-configured environment files for common stacks
- Complete configuration examples
- Comments explaining each variable

### Example Workflow

Located in `src/examples/ReporterWorkflow.ts`:
- Complete workflow implementation
- Provider initialization
- Test failure processing
- Database storage
- Notification sending

## Git Workflow

### Current Branch

- **Main Branch**: `main`
- **Topic Branches**: `autofix/{test-name}-{timestamp}` for auto-healing PRs

### Recent Activity

Recent commits focus on:
- Color logging enhancements
- Event logging implementation
- Configuration improvements

### Modified Files

- `src/colors.ts` - Uncommitted changes to ANSI color codes

## AI-Specific Guidance

### When Working on This Project

1. **Read before writing** - Always read existing files before modifying
2. **Follow patterns** - Match existing code style and patterns
3. **Use providers** - Leverage the provider architecture for extensibility
4. **Type safety first** - Maintain strict TypeScript typing
5. **Document changes** - Update relevant documentation
6. **Test thoroughly** - Ensure changes work with different provider combinations

### Common Pitfalls to Avoid

- Don't hard-code provider implementations; use factories
- Don't skip error handling for external API calls
- Don't mix provider types (e.g., AI provider doing database operations)
- Don't bypass ProviderRegistry; always use centralized management
- Don't commit sensitive credentials or API keys
- Don't create configuration that locks users into specific providers

### Best Practices

- **Lazy initialization** - Initialize providers only when needed
- **Configuration validation** - Validate all environment variables upfront
- **Graceful degradation** - Continue operation when optional features fail
- **Clear logging** - Provide helpful log messages for debugging
- **Modular design** - Keep provider implementations independent
- **Type exports** - Export all types for consumer usage

## Feature Flags and Options

### Core Features (can be enabled/disabled)

- `generateFix` - AI-powered fix suggestions
- `createBug` - Automatic bug creation
- `generatePR` - Automatic pull request creation
- `publishToDB` - Database storage
- `sendEmail` - Email notifications

### Auto-Healing Workflow

When `generatePR: true`:
1. Generate AI fix (`generateFix` must also be true)
2. Create topic branch: `autofix/{test-name}-{timestamp}`
3. Commit changes to topic branch
4. Push to remote
5. Create draft PR from topic branch to base branch
6. Add labels: `auto-fix`, `test-failure`, `ai-generated`

## Additional Resources

### Documentation Links

- [Complete Documentation Hub](./docs/README.md)
- [Quick Start Guide](./docs/QUICKSTART.md)
- [Provider Documentation](./docs/PROVIDERS.md)
- [Architecture & Design](./docs/design.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

### External Resources

- [Playwright Documentation](https://playwright.dev/)
- [GitHub Repository](https://github.com/deepakkamboj/playwright-ai-reporter)
- [NPM Package](https://www.npmjs.com/package/playwright-ai-reporter)

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Last Updated**: 2026-01-14
**Version**: 0.0.1
**Maintained By**: Deepak Kamboj
