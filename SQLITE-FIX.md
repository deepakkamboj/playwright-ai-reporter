# SQLite3 Native Binding Fix

## Problem

The reporter was failing for consumers in CI environments with the error:
```
Error: Could not locate the bindings file
```

This occurred because `sqlite3` requires native bindings that need to be compiled for each platform. In CI environments (GitHub Actions, Azure Pipelines, etc.), these bindings often fail to compile or aren't available for the specific Node.js version and platform combination.

## Root Cause

The issue was that `sqlite3` was:
1. Listed as a **required** dependency in `package.json`
2. Imported at the **top of the module** in `SQLiteProvider.ts`

This meant that even when users had `publishToDB: false` (database disabled), the module would still try to load `sqlite3` at startup, causing the entire reporter to crash.

## Solution Implemented

### 1. Made SQLite Optional Dependencies

Moved `sqlite3` and `sqlite` from `dependencies` to `optionalDependencies` in [package.json](package.json):

```json
"optionalDependencies": {
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7"
}
```

This allows npm to skip these packages if they fail to install without breaking the entire installation.

### 2. Lazy Loading with Dynamic Imports

Modified [SQLiteProvider.ts](src/providers/databases/SQLiteProvider.ts) to use dynamic imports:

```typescript
// OLD: Import at module load time (fails immediately if sqlite3 not available)
import sqlite3 from 'sqlite3';
import {open, Database} from 'sqlite';

// NEW: Lazy load only when initialize() is called
async initialize(): Promise<void> {
    try {
        this.sqlite3 = await import('sqlite3');
        this.sqlite = await import('sqlite');
    } catch (importError) {
        throw new Error(
            `Failed to load SQLite dependencies. ` +
            `Please install them with: npm install sqlite3 sqlite\n` +
            `Original error: ${importError.message}\n\n` +
            `If you're experiencing native binding issues in CI, consider:\n` +
            `1. Setting publishToDB: false to disable database features\n` +
            `2. Using a different DATABASE_PROVIDER (e.g., mysql)\n` +
            `3. Installing better-sqlite3 instead (future support coming)`
        );
    }
    // ... rest of initialization
}
```

### 3. Enhanced Error Handling

Updated [DatabaseFactory.ts](src/providers/factories/DatabaseFactory.ts) to provide clear error messages when SQLite dependencies are missing:

```typescript
try {
    await provider.initialize();
} catch (error: any) {
    if (error.message?.includes('Failed to load SQLite dependencies')) {
        throw new Error(
            `SQLite dependencies not available. ` +
            `This is common in CI environments where native bindings may not compile.\n\n` +
            `Solutions:\n` +
            `1. Set publishToDB: false in your reporter config to disable database features\n` +
            `2. Use a different database provider: DATABASE_PROVIDER=mysql\n` +
            `3. Install sqlite3 with: npm install sqlite3 sqlite`
        );
    }
    throw error;
}
```

## Impact

### Before Fix
- ❌ Reporter crashes even when database features are disabled
- ❌ Users forced to disable the entire reporter in CI
- ❌ Unhelpful error messages

### After Fix
- ✅ Reporter works without sqlite3 when `publishToDB: false`
- ✅ SQLite only loaded when actually needed
- ✅ Clear error messages guiding users to solutions
- ✅ Graceful degradation - other features continue working

## Usage Recommendations

### For Users Who Don't Need Database Features

Simply set `publishToDB: false` in your reporter config:

```typescript
{
  reporters: [
    ['playwright-ai-reporter', {
      publishToDB: false,  // Database features disabled - no sqlite3 needed!
      generateFix: false,
      createBug: false,
      generatePR: false,
      sendEmail: false
    }]
  ]
}
```

The reporter will work perfectly without sqlite3 installed.

### For Users Who Need Database Features

#### Option 1: Use MySQL Instead (Recommended for CI)
```bash
DATABASE_PROVIDER=mysql
MYSQL_HOST=your-mysql-host
MYSQL_USER=your-user
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=test_results
```

#### Option 2: Fix SQLite in CI
Add a post-install script in your project:
```json
{
  "scripts": {
    "postinstall": "cd node_modules/sqlite3 && npm run install"
  }
}
```

#### Option 3: Wait for better-sqlite3 Support
We plan to add support for `better-sqlite3` which has better cross-platform support.

## Testing

The fix has been tested by:
1. ✅ Building the project with `npm run build`
2. ✅ Verifying dynamic imports in compiled JavaScript
3. ✅ Confirming no top-level sqlite3 imports remain

## Future Improvements

1. **Add better-sqlite3 support** - More reliable native bindings
2. **Add JSON file fallback** - Store results in JSON when no database available
3. **Pre-compiled binaries** - Bundle pre-built binaries for common platforms

## Related Issues

- Original issue: SQLite3 native binding errors in CI environments
- Affects: GitHub Actions, Azure Pipelines, Jenkins, and other CI systems
- Similar issues in other projects: This is a common problem with native Node.js modules

## Version

Fixed in version: `0.0.2` (next release)
