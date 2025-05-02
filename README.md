# **Playwright Test Reporter**

[![Build Status](https://github.com/deepakkamboj/playwright-test-reporter/actions/workflows/ci.yml/badge.svg)](https://github.com/deepakkamboj/playwright-test-reporter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/playwright-test-reporter.svg)](https://www.npmjs.com/package/playwright-test-reporter)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.51%2B-green)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent, AI-powered reporter for Playwright tests that enhances debugging with automatic failure categorization, test code extraction, and GenAI-powered fix suggestions. Perfect for tackling flaky tests and improving test reliability in CI/CD pipelines.

## **✨ Features**

- 🎨 **Smart Colorized Output**:
    - ✅ Passed tests (Green)
    - ❌ Failed tests (Red)
    - 🔄 Retry attempts (Yellow)
    - ⚠️ Skipped tests (Gray)
    - 🚀 Test run status (Bright Magenta)

- 🧠 **Intelligent Failure Analysis**:
    - Automatic **error categorization** (ElementNotFound, Timeout, SelectorChanged, etc.)
        - This will help identifying major area of concern through error reporting.
    - Test code block extraction for context-aware reporting
    - AI-powered fix suggestions for common test failures
    - Structured JSON output for failure analysis

- 📊 **Comprehensive Metrics**:
    - Total execution time with smart formatting
    - Average test duration analysis
    - Slowest test identification
    - Top slowest tests ranking
    - Pass/fail/skip statistics

- 🛠 **Advanced Features**:
    - **Generative AI** integration for intelligent fix suggestions for **Flaky tests**.
        - Using `Mistral` based `mistral-large-latest` model for generating fixes.
    - Accessibility snapshot support (placeholder ready)
    - Team ownership assignment and tracking
    - Configurable slow test thresholds
    - Timeout warnings
    - Stack trace controls
    - Retry attempt tracking
    - CI integration with build information
    - Test history tracking and comparison

- 📝 **Rich Reporting**:
    - Detailed failure analysis with categorization
    - GenAI-powered fix suggestions
    - Clear error messages
    - Formatted stack traces
    - Test timing insights
    - Skipped test warnings
    - Test history tracking
    - CI environment detection

## **🚀 Installation**

Install the package using npm:

```bash
npm install playwright-test-reporter --save-dev
```

---

## **Usage**

Integrate the `playwright-test-reporter` into your Playwright configuration file (`playwright.config.ts`):

```typescript
import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './tests', // Adjust to your test directory
    retries: 2, // Example of using retries
    reporter: [['playwright-test-reporter', {
        slowTestThreshold: 3,
        maxSlowTestsToShow: 5,
        timeoutWarningThreshold: 20,
        showStackTrace: true,
        outputDir: './test-results',
        generateFix: true,               // Enable AI-powered fix suggestions
        categorizeFailures: true         // Enable automatic failure categorization
    }]],
    use: {
        trace: 'on-first-retry', // Example: trace only on retries
        video: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
});
```

### **Reporter Configuration Options**

| Option                   | Type      | Default         | Description |
|--------------------------|-----------|-----------------|-------------|
| `slowTestThreshold`      | `number`  | `5`             | Time in seconds after which a test is considered slow |
| `maxSlowTestsToShow`     | `number`  | `3`             | Maximum number of slowest tests to display in the report |
| `timeoutWarningThreshold`| `number`  | `30`            | Time in seconds after which to show a timeout warning |
| `showStackTrace`         | `boolean` | `true`          | Whether to show stack traces in error reports |
| `outputDir`              | `string`  | `./test-results`| Directory where JSON output files will be saved |
| `generateFix`            | `boolean` | `false`         | Whether to generate AI-powered fix suggestions for failing tests |
| `categorizeFailures`     | `boolean` | `true`          | Whether to categorize failures by type for better analysis |

### **AI-Powered Fix Suggestions**

To use the GenAI-powered fix suggestion feature:

1. Create a `.env` file in your project root with your Mistral API key:
   ```
   MISTRAL_API_KEY=your_key_here
   ```

2. Enable the `generateFix` option in your configuration:
   ```typescript
   reporter: [['playwright-test-reporter', {
     generateFix: true
   }]]
   ```

Fix suggestions will be generated in the `test-results/fixes` directory, with corresponding prompts in `test-results/prompts`.

### **Team Ownership**

You can specify test ownership by team using annotations:

```typescript
// Using annotations
test.describe('User authentication', () => {
  test('should login successfully', {
    annotation: { type: 'team', description: 'Frontend' }
  }, async ({ page }) => {
    // Test implementation
  });
});

// Alternatively, by including team name in the test title
test('[Frontend] should login successfully', async ({ page }) => {
  // Test implementation
});
```

### **Working with Test History**

The reporter includes utilities for working with test history:

```typescript
import { HistoryUtils } from 'playwright-test-reporter';

// Check if a test was failing in the previous run
const wasFailing = HistoryUtils.wasTestFailingPreviously('test-id-123');

// Compare current failures with previous run
const { newlyFailing, fixed } = HistoryUtils.compareWithPreviousRun(['test-id-456', 'test-id-789']);

console.log('New failures:', newlyFailing);
console.log('Fixed tests:', fixed);
```

### **JSON Output Files**

The reporter generates the following JSON files:

- **testSummary.json**: Contains complete test run summary and metrics
- **testFailures.json**: Detailed information about test failures
- **.last-run.json**: Status of the last test run for comparison
- **prompts/*.md**: AI prompts for test failures
- **fixes/fix-*.md**: AI-generated fix suggestions

These files can be used for:
- CI/CD pipeline integration
- Test history analysis
- Trend monitoring and reporting
- Build pass/fail decisions
- Automatic PR comments with fix suggestions

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

### **Failed Run with GenAI Suggestions**

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
  - Prompt: /home/user/project/test-results/prompts/api-test.md
  - Fix: /home/user/project/test-results/fixes/fix-api-test.md
AI fix suggestion generation complete

Additional Metrics:
- Average passed test time: 1.23s
- Slowest test took: 1.23s
- Top 3 slowest tests:
  1. Login test: 1.23s

Test Failures:
--- Failure #1 ---
  Test: API test
  Category: NetworkError
  Stack Trace:
    at Connection.connect (/src/api/connection.ts:45:7)
```

### **CI Run Output**

```plaintext
🚀 Starting test run: 8 tests using 2 workers
✅ Homepage test passed in 1.05s
✅ Product list test passed in 2.33s
❌ Checkout test failed in 3.12s

❌ 1 of 8 tests failed | 7 passed | 0 skipped | ⏱ Total: 12.48s

Build Information:
- CI System: GitHub Actions
- Build: 1234
- Branch: main
- Commit: abc12345
- Build link: https://github.com/user/repo/actions/runs/1234
- Artifacts: https://github.com/user/repo/actions/runs/1234/artifacts
```

## **🧰 Architecture**

The package consists of several core components:

1. **Reporter**: Main entry point that implements Playwright's Reporter interface
2. **TestUtils**: Utility functions for processing and calculating test metrics
3. **Logger**: Handles colorized console output formatting
4. **GenAIUtils**: Provides AI-powered fix suggestions for failing tests
5. **FileHandler**: Manages writing test results to JSON files
6. **HistoryUtils**: Provides functionality for test history comparison
7. **BuildInfoUtils**: Detects CI environment and extracts build information
8. **PromptUtils**: Handles test code extraction and prompt generation

## **🤝 Contributing**

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create your feature branch:
    ```bash
    git checkout -b feature/amazing-feature
    ```
3. Make your changes and commit them:
    ```bash
    git commit -m 'Add some amazing feature'
    ```
4. Push to your fork:
    ```bash
    git push origin feature/amazing-feature
    ```
5. Open a Pull Request

Please ensure your PR:

- Follows the existing code style
- Includes appropriate tests
- Updates documentation as needed
- Describes the changes made

---

## **📝 License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## **🙏 Acknowledgments**

- Built with [Playwright](https://playwright.dev/)
- Inspired by the need for better test reporting and automatic debugging in CI/CD pipelines
- AI-powered fix suggestions powered by Mistral AI
- Thanks to all contributors who help make this reporter better
