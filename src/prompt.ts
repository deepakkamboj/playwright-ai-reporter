import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFailure } from './types';
import { codeFrameColumns } from "@babel/code-frame";
import { parseErrorStack } from './stackTrace';

// Regular expression to match ANSI escape codes for stripping colors
export const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');

/**
 * Strips ANSI escape codes (used for terminal coloring) from a string
 * 
 * @param str - The string to process
 * @returns String without ANSI escape codes
 */
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}
export type GitCommitInfo = {
    shortHash: string;
    hash: string;
    subject: string;
    body: string;
    author: {
      name: string;
      email: string;
      time: number;
    };
    committer: {
      name: string;
      email: string
      time: number;
    };
    branch: string;
  };
  
  export type CIInfo = {
    commitHref: string;
    prHref?: string;
    prTitle?: string;
    prBaseHash?: string;
    buildHref?: string;
    commitHash?: string;
    branch?: string;
  };
export type MetadataWithCommitInfo = {
    ci?: CIInfo;
    gitCommit?: GitCommitInfo;
    gitDiff?: string;
  };

/**
 * Generates an error prompt for a test failure
 * 
 * @param failure - The test failure information
 * @param sourceCode - Source code of the test file
 * @returns Formatted prompt for AI analysis
 */
export function generateErrorPrompt(failure: TestFailure, sourceCode: string): string {
  const promptParts = [
    `# Instructions`,
    '',
    `- Following Playwright test failed.`,
    `- Explain why, be concise, respect Playwright best practices.`,
    `- Provide a snippet of code with the fix, if possible.`,
    '',
    `# Test info`,
    '',
    `- Name: ${failure.testTitle}`,
    `- Suite: ${failure.suiteTitle}`,
    `- Location: ${failure.testFile}:${failure.location?.line || 'unknown'}:${failure.location?.column || 'unknown'}`,
    `- Team: ${failure.owningTeam}`,
    `- Category: ${failure.errorCategory}`,
    '',
    '# Error details',
    '',
    '```',
    stripAnsiEscapes(failure.errorMessage || ''),
    '```',
  ];

  if (failure.errorStack) {
    promptParts.push(
      '',
      '# Stack trace',
      '',
      '```',
      stripAnsiEscapes(failure.errorStack),
      '```'
    );
  }

  if (sourceCode) {
    promptParts.push(
      '',
      '# Test source',
      '',
      '```ts',
      sourceCode,
      '```'
    );
  }

  return promptParts.join('\n');
}

/**
 * Saves an error prompt to a file
 * 
 * @param prompt - The prompt content
 * @param outputDir - Directory to save the prompt
 * @param fileName - Name for the prompt file
 * @returns Path to the saved file
 */
export async function saveErrorPrompt(prompt: string, outputDir: string, fileName: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const promptPath = path.join(outputDir, fileName);
  await fs.writeFile(promptPath, prompt, 'utf8');
  return promptPath;
}

/**
 * Interface for test information
 */
export interface TestInfo {
  titlePath: string[];
  file: string;
  line: number;
  column: number;
  errors: Array<{ message?: string; stack?: string }>;
  attachments: Array<{ name: string; path?: string; body?: Buffer; contentType: string }>;
  config: {
    metadata: any;
  };
  outputPath: (relativePath: string) => string;
  // Add _attach method to support attaching files
  _attach?: (attachment: { name: string; contentType: string; path?: string; body?: Buffer }, options?: unknown) => void;
}

/**
 * Interface for error location
 */
interface ErrorLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * Attaches error prompts to test information
 * @param testInfo - Test information
 * @param sourceCache - Cache of source code files
 * @param ariaSnapshot - Optional snapshot data
 */
export async function attachErrorPrompts(testInfo: TestInfo, sourceCache: Map<string, string>, ariaSnapshot: string | undefined): Promise<void> {
  if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)
    return;

  const meaningfulSingleLineErrors = new Set(testInfo.errors.filter(e => e.message && !e.message.includes('\n')).map(e => e.message!));
  for (const error of testInfo.errors) {
    for (const singleLineError of meaningfulSingleLineErrors.keys()) {
      if (error.message?.includes(singleLineError))
        meaningfulSingleLineErrors.delete(singleLineError);
    }
  }

  const errors = [...testInfo.errors.entries()].filter(([, error]) => {
    if (!error.message)
      return false;

    // Skip errors that are just a single line - they are likely to already be the error message.
    if (!error.message.includes('\n') && !meaningfulSingleLineErrors.has(error.message))
      return false;

    return true;
  });

  for (const [index, error] of errors) {
    const metadata = testInfo.config.metadata;
    if (testInfo.attachments.find(a => a.name === `_prompt-${index}`))
      continue;

    const promptParts = [
      `# Instructions`,
      '',
      `- Following Playwright test failed.`,
      `- Explain why, be concise, respect Playwright best practices.`,
      `- Provide a snippet of code with the fix, if possible.`,
      '',
      `# Test info`,
      '',
      `- Name: ${testInfo.titlePath.slice(1).join(' >> ')}`,
      `- Location: ${testInfo.file}:${testInfo.line}:${testInfo.column}`,
      '',
      '# Error details',
      '',
      '```',
      stripAnsiEscapes(error.stack || error.message || ''),
      '```',
    ];

    if (ariaSnapshot) {
      promptParts.push(
          '',
          '# Page snapshot',
          '',
          '```yaml',
          ariaSnapshot,
          '```',
      );
    }

    const parsedError = error.stack ? parseErrorStack(error.stack, path.sep) : undefined;
    const inlineMessage = stripAnsiEscapes(parsedError?.message || error.message || '').split('\n')[0];
    const location = parsedError?.location || { file: testInfo.file, line: testInfo.line, column: testInfo.column };
    const source = await loadSource(location.file, sourceCache);
    const codeFrame = codeFrameColumns(
        source,
        {
          start: {
            line: location.line,
            column: location.column
          },
        },
        {
          highlightCode: false,
          linesAbove: 100,
          linesBelow: 100,
          message: inlineMessage || undefined,
        }
    );
    promptParts.push(
        '',
        '# Test source',
        '',
        '```ts',
        codeFrame,
        '```',
    );

    if (metadata.gitDiff) {
      promptParts.push(
          '',
          '# Local changes',
          '',
          '```diff',
          metadata.gitDiff,
          '```',
      );
    }

    const promptPath = testInfo.outputPath(errors.length === 1 ? `prompt.md` : `prompt-${index}.md`);
    await fs.writeFile(promptPath, promptParts.join('\n'), 'utf8');

    // Use type assertion to handle the _attach method
    if (testInfo._attach) {
      testInfo._attach({
        name: `_prompt-${index}`,
        contentType: 'text/markdown',
        path: promptPath,
      }, undefined);
    }
  }
}

/**
 * Attaches error context to test information
 * @param testInfo - Test information
 * @param ariaSnapshot - Optional snapshot data
 */
export async function attachErrorContext(testInfo: TestInfo, ariaSnapshot: string | undefined): Promise<void> {
  if (!ariaSnapshot || !testInfo._attach)
    return;

  testInfo._attach({
    name: `_error-context`,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({
      pageSnapshot: ariaSnapshot,
    })),
  }, undefined);
}

/**
 * Loads source code from a file
 * 
 * @param file - Path to the file
 * @param sourceCache - Cache of already loaded source files
 * @returns Source code as string
 */
export async function loadSource(file: string, sourceCache: Map<string, string>): Promise<string> {
  let source = sourceCache.get(file);
  if (!source) {
    // A mild race is Ok here.
    source = await fs.readFile(file, 'utf8');
    sourceCache.set(file, source);
  }
  return source;
}