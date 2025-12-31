# Playwright AI Test Reporter - Provider-Based Architecture

## Overview

This reporter has been refactored into a generalized provider-based framework that supports multiple implementations for each service type. This architecture allows you to easily switch between different service providers without changing the core reporter code.

## Provider Types

### 1. AI Providers

The reporter supports multiple AI providers for generating test failure suggestions and auto-healing:

- **Azure OpenAI** - Uses Azure's OpenAI service with managed identity or PAT authentication
- **OpenAI** - Direct integration with OpenAI's API
- **Anthropic** - Claude models for AI suggestions
- **Google AI** - Gemini models
- **Mistral AI** - Mistral's AI models

**Configuration:**

```env
AI_PROVIDER=azure-openai  # or: openai, anthropic, google-ai, mistral
```

### 2. Bug Tracker Providers

Create bugs/issues automatically for failing tests:

- **Azure DevOps** - Create work items in Azure DevOps
- **GitHub** - Create issues in GitHub repositories
- **Jira** - Create tickets in Jira

**Configuration:**

```env
BUG_TRACKER_PROVIDER=github  # or: azure-devops, jira
```

### 3. Database Providers

Store test run and test result data:

- **SQLite** - Lightweight local database
- **MySQL** - MySQL database
- **PostgreSQL** - PostgreSQL database (coming soon)

**Configuration:**

```env
DATABASE_PROVIDER=sqlite  # or: mysql, postgresql
```

### 4. PR Providers

Auto-generate pull requests with fixes:

- **GitHub** - Create PRs in GitHub repositories
- **Azure DevOps** - Create PRs in Azure Repos

**Configuration:**

```env
PR_PROVIDER=github  # or: azure-devops
```

### 5. Notification Providers

Send notifications about test results:

- **Email** - Send email notifications
- **Slack** - Post to Slack channels (coming soon)
- **Microsoft Teams** - Post to Teams channels (coming soon)

**Configuration:**

```env
NOTIFICATION_PROVIDER=email  # or: slack, teams
```

## Usage

### Basic Setup

1. Copy `.env.example` to `.env`:

```bash
cp examples/env-configs/.env.example .env
```

2. Configure your providers in `.env`:

```env
AI_PROVIDER=azure-openai
BUG_TRACKER_PROVIDER=github
DATABASE_PROVIDER=sqlite
PR_PROVIDER=github
NOTIFICATION_PROVIDER=email
```

3. Add provider-specific configuration (API keys, endpoints, etc.)

### Programmatic Configuration

You can also configure providers programmatically:

```typescript
import {ProviderRegistry} from './providers/ProviderRegistry';

// Initialize with custom configuration
await ProviderRegistry.initialize({
    ai: {
        type: 'openai',
        config: {apiKey: 'your-api-key'},
    },
    bugTracker: {
        type: 'github',
        config: {token: 'your-token'},
    },
    database: {
        type: 'sqlite',
        config: {dbPath: './test-results.db'},
    },
});

// Get providers
const aiProvider = await ProviderRegistry.getAIProvider();
const bugTracker = await ProviderRegistry.getBugTrackerProvider();
const database = await ProviderRegistry.getDatabaseProvider();
```

### Using Individual Factories

You can also use individual factories directly:

```typescript
import {AIProviderFactory, AIProviderType} from './providers/ai/AIProviderFactory';

// Create a specific provider
const aiProvider = await AIProviderFactory.createProvider(AIProviderType.OpenAI);

// Or create from environment variable
const aiProvider = await AIProviderFactory.createFromEnv('AI_PROVIDER');
```

## Architecture

```
src/
├── providers/
│   ├── interfaces/           # Provider interfaces
│   │   ├── IAIProvider.ts
│   │   ├── IBugTrackerProvider.ts
│   │   ├── IDatabaseProvider.ts
│   │   ├── INotificationProvider.ts
│   │   └── IPRProvider.ts
│   ├── ai/                   # AI provider implementations
│   │   ├── AzureOpenAIProvider.ts
│   │   ├── OpenAIProvider.ts
│   │   ├── AnthropicProvider.ts
│   │   ├── GoogleAIProvider.ts
│   │   ├── MistralProvider.ts
│   │   └── AIProviderFactory.ts
│   ├── bugTrackers/          # Bug tracker implementations
│   │   ├── AzureDevOpsBugTracker.ts
│   │   ├── GitHubBugTracker.ts
│   │   └── JiraBugTracker.ts
│   ├── databases/            # Database implementations
│   │   ├── SQLiteProvider.ts
│   │   └── MySQLProvider.ts
│   ├── notifications/        # Notification implementations
│   │   └── EmailNotificationProvider.ts
│   ├── pr/                   # PR provider implementations
│   │   ├── GitHubPRProvider.ts
│   │   └── AzureDevOpsPRProvider.ts
│   ├── factories/            # Factory classes
│   │   ├── BugTrackerFactory.ts
│   │   ├── DatabaseFactory.ts
│   │   ├── NotificationFactory.ts
│   │   └── PRProviderFactory.ts
│   ├── ProviderRegistry.ts   # Central provider registry
│   └── index.ts              # Provider exports
```

## Adding New Providers

### 1. Create Provider Implementation

```typescript
// src/providers/ai/NewAIProvider.ts
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';

export class NewAIProvider implements IAIProvider {
    getName(): string {
        return 'New AI Provider';
    }

    async initialize(): Promise<void> {
        // Initialize connection, load config, etc.
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        // Implementation
    }

    async generateText(prompt: string, config?: AIModelConfig): Promise<string> {
        // Implementation
    }

    async testConnection(): Promise<boolean> {
        // Test the connection
    }
}
```

### 2. Update Factory

```typescript
// Add to AIProviderFactory.ts
import { NewAIProvider } from './NewAIProvider';

export enum AIProviderType {
  // ... existing types
  NewProvider = 'new-provider',
}

// Add case in createProvider method
case AIProviderType.NewProvider:
  provider = new NewAIProvider();
  break;
```

### 3. Update Documentation

Add the new provider to `.env.example` and this README.

## Environment Variables Reference

See example files in `examples/env-configs/` for a complete list of all supported environment variables for each provider type.

## Features

- **Flexible Provider System**: Easily switch between different service providers
- **Factory Pattern**: Centralized provider creation and management
- **Lazy Initialization**: Providers are only initialized when needed
- **Type Safety**: Full TypeScript support with proper interfaces
- **Environment-Based Config**: Configure via environment variables or programmatically
- **Extensible**: Easy to add new providers without changing existing code

## Testing

Each provider can be tested independently:

```typescript
const provider = await AIProviderFactory.createProvider('openai');
const isConnected = await provider.testConnection();
console.log(`Connection status: ${isConnected}`);
```

## License

See LICENSE file for details.
