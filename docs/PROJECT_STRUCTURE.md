# 📁 Project Structure

This document provides an overview of the Playwright AI Test Reporter project structure.

## Root Directory

```
playwright-ai-test-reporter/
├── 📄 README.md                      # Main project documentation
├── 📄 LICENSE                        # MIT License
├── 📄 package.json                   # NPM package configuration
├── 📄 tsconfig.json                  # TypeScript configuration
├── 📄 playwright.config.ts           # Playwright configuration
│
├── 📁 examples/                     # Example configurations and tests
│   ├── env-configs/               # Pre-configured .env files
│   └── tests/                     # Sample test files



│
├── 🛠️ .eslintrc.cjs                  # ESLint configuration
├── 🛠️ .prettierrc                    # Prettier configuration
├── 🛠️ .gitignore                     # Git ignore rules
├── 🛠️ .npmignore                     # NPM ignore rules
│
├── 📁 docs/                          # 📚 Documentation folder
│   ├── README.md                     # Documentation index
│   ├── QUICKSTART.md                 # Quick start guide
│   ├── PROVIDERS.md                  # Provider documentation
│   ├── ENV_CONFIG_GUIDE.md           # Environment configuration guide
│   ├── design.md                     # Architecture and design
│   ├── IMPLEMENTATION_SUMMARY.md     # Implementation details
│   └── BUILD_FIXES.md                # Build troubleshooting
│
├── 📁 src/                           # 💻 Source code
│   ├── reporter.ts                   # Main Playwright reporter
│   ├── colors.ts                     # Color utilities for console
│   ├── fixture.ts                    # Test fixtures (if any)
│   │
│   ├── 📁 providers/                 # Provider implementations
│   │   ├── ProviderRegistry.ts       # Centralized provider management
│   │   │
│   │   ├── 📁 interfaces/            # Provider interfaces
│   │   │   ├── IAIProvider.ts
│   │   │   ├── IBugTrackerProvider.ts
│   │   │   ├── IDatabaseProvider.ts
│   │   │   ├── INotificationProvider.ts
│   │   │   └── IPRProvider.ts
│   │   │
│   │   ├── 📁 ai/                    # AI provider implementations
│   │   │   ├── AzureOpenAIProvider.ts
│   │   │   ├── OpenAIProvider.ts
│   │   │   ├── AnthropicProvider.ts
│   │   │   ├── GoogleAIProvider.ts
│   │   │   └── MistralProvider.ts
│   │   │
│   │   ├── 📁 bugTrackers/           # Bug tracker implementations
│   │   │   ├── GitHubBugTracker.ts
│   │   │   ├── AzureDevOpsBugTracker.ts
│   │   │   └── JiraBugTracker.ts
│   │   │
│   │   ├── 📁 databases/             # Database implementations
│   │   │   ├── SQLiteProvider.ts
│   │   │   ├── MySQLProvider.ts
│   │   │   └── PostgreSQLProvider.ts (planned)
│   │   │
│   │   ├── 📁 notifications/         # Notification implementations
│   │   │   ├── EmailNotificationProvider.ts
│   │   │   ├── SlackProvider.ts (planned)
│   │   │   └── TeamsProvider.ts (planned)
│   │   │
│   │   ├── 📁 pr/                    # PR provider implementations
│   │   │   ├── GitHubPRProvider.ts
│   │   │   └── AzureDevOpsPRProvider.ts
│   │   │
│   │   └── 📁 factories/             # Provider factories
│   │       ├── AIProviderFactory.ts
│   │       ├── BugTrackerFactory.ts
│   │       ├── DatabaseProviderFactory.ts
│   │       ├── NotificationProviderFactory.ts
│   │       └── PRProviderFactory.ts
│   │
│   ├── 📁 utils/                     # Utility functions
│   │   ├── config.ts                 # Configuration utilities
│   │   ├── configValidator.ts        # Configuration validation
│   │   ├── fileHandlerUtils.ts       # File operations
│   │   ├── genaiUtils.ts             # AI utilities
│   │   ├── historyUtils.ts           # Test history management
│   │   ├── buildInfoUtils.ts         # CI/CD build info extraction
│   │   └── utils.ts                  # General utilities
│   │
│   ├── 📁 types/                     # TypeScript type definitions
│   │   └── index.ts                  # Main type definitions
│   │
│   └── 📁 examples/                  # Usage examples
│       └── ReporterWorkflow.ts       # Complete workflow example
│
├── 📁 tests/                         # 🧪 Test files
│   ├── google-search.test.ts
│   ├── mixed-results.test.ts
│   └── playwright-site.test.ts
│
├── 📁 dist/                          # 📦 Compiled output (gitignored)
│   └── (TypeScript compiled files)
│
├── 📁 old/                           # 🗃️ Legacy code (for reference)
│   ├── adoUtils.ts
│   └── reporter.ts
│
├── 📁 .github/                       # GitHub specific files
│   ├── copilot-instructions.md
│   └── pull_request_template.md
│
└── 📁 node_modules/                  # NPM dependencies (gitignored)
```

## Key Directories Explained

### 📁 `docs/`

Contains all project documentation. Start here for guides and references.

- **README.md** - Documentation index with navigation
- **QUICKSTART.md** - Get started in 5 minutes
- **PROVIDERS.md** - Complete provider reference
- **ENV_CONFIG_GUIDE.md** - Environment setup guide
- **design.md** - System architecture
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation
- **BUILD_FIXES.md** - Troubleshooting guide

### 📁 `src/`

Main source code directory following a modular architecture.

#### `src/providers/`

Provider-based architecture with factory pattern:

- **ProviderRegistry.ts** - Singleton managing all providers
- **interfaces/** - TypeScript interfaces for all provider types
- **ai/** - 5 AI provider implementations
- **bugTrackers/** - 3 bug tracking integrations
- **databases/** - 2 database implementations
- **notifications/** - Email and messaging providers
- **pr/** - Pull request automation
- **factories/** - Factory classes for provider creation

#### `src/utils/`

Utility functions and helpers:

- **genaiUtils.ts** - AI integration utilities
- **fileHandlerUtils.ts** - File I/O operations
- **buildInfoUtils.ts** - CI/CD metadata extraction
- **historyUtils.ts** - Test history tracking
- **config.ts** - Configuration management
- **configValidator.ts** - Configuration validation

#### `src/types/`

TypeScript type definitions for the entire project.

#### `src/examples/`

Working code examples showing how to use the framework.

### 📁 `tests/`

Sample Playwright tests for testing the reporter.

### 📁 `old/`

Legacy code kept for reference. Not used in production.

### 🔧 Configuration Files

- **`.env.*-stack`** - Pre-configured environment files for different provider stacks
- **`tsconfig.json`** - TypeScript compiler configuration
- **`playwright.config.ts`** - Playwright test configuration
- **`.eslintrc.cjs`** - ESLint code quality rules
- **`.prettierrc`** - Code formatting rules
- **`package.json`** - NPM package and scripts configuration

## File Naming Conventions

- **PascalCase** - TypeScript classes and interfaces (e.g., `AzureOpenAIProvider.ts`)
- **camelCase** - Utility files (e.g., `genaiUtils.ts`)
- **UPPERCASE** - Documentation files (e.g., `README.md`, `QUICKSTART.md`)
- **kebab-case** - Configuration files (e.g., `.env.github-stack`)

## Important Files

### Must Read

1. **README.md** - Start here
2. **docs/QUICKSTART.md** - Quick setup
3. **docs/ENV_CONFIG_GUIDE.md** - Configuration guide

### For Developers

1. **src/providers/ProviderRegistry.ts** - Core provider management
2. **src/examples/ReporterWorkflow.ts** - Usage example
3. **docs/design.md** - Architecture overview
4. **docs/IMPLEMENTATION_SUMMARY.md** - Implementation details

### For Configuration

1. **`.env.github-stack`** - GitHub configuration template
2. **`.env.azure-stack`** - Azure configuration template
3. **docs/ENV_CONFIG_GUIDE.md** - Setup instructions

## Build Output

The `dist/` folder contains compiled JavaScript files:

```
dist/
├── src/
│   ├── providers/
│   │   ├── ai/
│   │   ├── bugTrackers/
│   │   ├── databases/
│   │   ├── notifications/
│   │   ├── pr/
│   │   ├── factories/
│   │   ├── interfaces/
│   │   └── ProviderRegistry.js
│   ├── utils/
│   ├── types/
│   ├── examples/
│   └── reporter.js
└── tests/
```

## Ignored Files/Folders

The following are ignored by Git (`.gitignore`):

- `node_modules/` - NPM dependencies
- `dist/` - Compiled output
- `.env` - Local environment variables
- `test-results/` - Test output
- `playwright-report/` - Playwright HTML report
- Coverage reports

## Navigation Tips

- **Documentation**: All docs are in `docs/` folder
- **Source Code**: All implementation in `src/` folder
- **Examples**: See `src/examples/` for working code
- **Tests**: Sample tests in `tests/` folder
- **Configuration**: .env files in project root

## Quick Commands

```bash
# View project structure
tree /F /A  # Windows
tree        # macOS/Linux

# Find specific files
Get-ChildItem -Recurse -Include "*.ts" | Select-Object FullName  # PowerShell
find . -name "*.ts"  # Unix

# Count lines of code
Get-ChildItem -Recurse -Include "*.ts" | Get-Content | Measure-Object -Line  # PowerShell
find . -name "*.ts" -exec wc -l {} +  # Unix
```

## Related Documentation

- [Architecture & Design](./design.md)
- [Provider Documentation](./PROVIDERS.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Quick Start Guide](./QUICKSTART.md)

---

**Last Updated**: December 29, 2025
