import axios from 'axios';
import { TestFailure } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Utility for generating AI-powered suggestions for test failures
 */
export class GenAIUtils {
  /**
   * Calls the Mistral API to get a suggestion for fixing a failed test
   * 
   * @param prompt - The prompt to send to the AI
   * @returns AI's suggested fix
   */
  static async callGenAISuggestion(prompt: string): Promise<string> {
    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      
      // Check for API key in environment or .env file
      if (!apiKey) {
        console.warn('MISTRAL_API_KEY not found in .env file or environment variables. Cannot generate AI suggestions.');
        console.warn('Please create a .env file in the project root with your MISTRAL_API_KEY.');
        return 'Error: Mistral API key not found in configuration';
      }

      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest', // Using Mistral's large model
          messages: [
            { role: 'system', content: 'You are a test engineer helping debug flaky Playwright tests.' },
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('[GenAI] Error calling Mistral API:', error);
      return 'Error retrieving suggestion from Mistral AI';
    }
  }

  /**
   * Generates a fix suggestion for a failed test
   * 
   * @param failure - The test failure information
   * @param sourceCode - Map of source code files for context
   * @returns The path to the saved suggestion file
   */
  static async generateFixSuggestion(
    failure: TestFailure,
    sourceCode: Map<string, string>
  ): Promise<{ promptPath: string; fixPath: string } | null> {
    if (!failure.testFile) {
      console.warn(`[GenAI] Cannot generate fix for test without file path: ${failure.testTitle}`);
      return null;
    }

    try {
      // Ensure the prompt and fixes directories exist
      const promptDir = path.join(process.cwd(), 'test-results', 'prompts');
      const fixesDir = path.join(process.cwd(), 'test-results', 'fixes');
      
      fs.mkdirSync(promptDir, { recursive: true });
      fs.mkdirSync(fixesDir, { recursive: true });

      // Read the source file content if not already in cache
      let source = sourceCode.get(failure.testFile);
      if (!source) {
        source = fs.readFileSync(failure.testFile, 'utf8');
        sourceCode.set(failure.testFile, source);
      }

      // Create the prompt
      const promptContent = [
        `# Instructions`,
        '',
        `- The following Playwright test failed.`,
        `- Explain why it failed and suggest a fix, respecting Playwright best practices.`,
        `- Be concise and provide a code snippet with the fix.`,
        '',
        `# Test info`,
        '',
        `- Name: ${failure.testTitle}`,
        `- File: ${failure.testFile}`,
        `- Line: ${failure.location?.line || 'unknown'}`,
        `- Column: ${failure.location?.column || 'unknown'}`,
        '',
        '# Error details',
        '',
        '```',
        failure.errorMessage,
        '```',
        '',
        '# Stack trace',
        '',
        '```',
        this.truncateStackTrace(failure.errorStack),
        '```',
        '',
        '# Test source',
        '',
        '```ts',
        source,
        '```'
      ].join('\n');

      // Generate a clean filename for the test
      const safeFilename = this.sanitizeFilename(
        failure.testId ? 
          `${failure.testId}` : 
          `${path.basename(failure.testFile, '.ts')}-${failure.testTitle}`
      );
      
      // Save the prompt
      const promptPath = path.join(promptDir, `${safeFilename}.md`);
      fs.writeFileSync(promptPath, promptContent, 'utf8');
      
      // Call AI for the fix suggestion
      const suggestion = await this.callGenAISuggestion(promptContent);
      
      // Save the suggestion
      const fixPath = path.join(fixesDir, `fix-${safeFilename}.md`);
      fs.writeFileSync(fixPath, suggestion, 'utf8');
      
      return { promptPath, fixPath };
    } catch (error) {
      console.error('[GenAI] Error generating fix suggestion:', error);
      return null;
    }
  }

  /**
   * Truncates a stack trace to a reasonable length
   * 
   * @param stack - The full stack trace
   * @returns Truncated stack trace
   */
  private static truncateStackTrace(stack: string): string {
    if (!stack) return '';
    
    const lines = stack.split('\n');
    // Return first 15 lines max to keep the context reasonable
    return lines.slice(0, 15).join('\n') + (lines.length > 15 ? '\n... (truncated)' : '');
  }

  /**
   * Sanitizes a filename to be used in a file path
   * 
   * @param filename - The filename to sanitize
   * @returns Sanitized filename
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '-')
      .substring(0, 100); // Limit length
  }
}
