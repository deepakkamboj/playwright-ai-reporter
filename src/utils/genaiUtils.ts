import {TestFailure} from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {AIMessage} from '../providers/interfaces/IAIProvider';
import {ProviderRegistry} from '../providers/ProviderRegistry';
import {CORRECTED_FILE_HEADING, parseFixResponse} from './aiResponse';
import {ReplacementCheck, validateReplacement} from './fixValidator';
import {redactText} from './redaction';

// Load environment variables from .env file
dotenv.config({path: path.resolve(process.cwd(), '.env')});

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Result of analysing one failure with the configured AI provider.
 */
export interface FixSuggestion {
    /** Prompt that was sent to the model. */
    promptPath: string;
    /** Full model response, saved for review. Never committed as code. */
    fixPath: string;
    /** Root-cause analysis: the response without the corrected file. */
    analysis: string;
    /** Complete corrected test file, present only when the model returned one. */
    patchedSource?: string;
    /** Outcome of the safety checks on `patchedSource`. Only an `ok` replacement may be committed. */
    replacement?: ReplacementCheck;
}

function numberFromEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Utility for generating AI-powered analysis and fix suggestions for test failures
 */
export class GenAIUtils {
    /**
     * Calls the configured AI provider.
     *
     * @param prompt - The prompt to send to the AI
     * @returns The model's response text
     * @throws When the provider is not configured or the call fails. A failure is never turned into
     * text, so an error message can not be mistaken for a fix.
     */
    static async callGenAISuggestion(prompt: string): Promise<string> {
        const provider = await ProviderRegistry.getAIProvider();
        console.log(`[GenAI] Using AI provider: ${provider.getName()}`);
        const safePrompt = redactText(prompt);

        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a test engineer analysing failing Playwright tests.',
            },
            {
                role: 'user',
                content: safePrompt,
            },
        ];

        const response = await provider.generateCompletion(messages, {
            maxTokens: numberFromEnv('AI_MAX_TOKENS', DEFAULT_MAX_TOKENS),
            temperature: numberFromEnv('AI_TEMPERATURE', DEFAULT_TEMPERATURE),
        });

        return redactText(response.content);
    }

    /**
     * Builds the prompt for one failure.
     */
    static buildFixPrompt(failure: TestFailure, source: string): string {
        return redactText(
            [
                `# Instructions`,
                '',
                `- The following Playwright test failed.`,
                `- Find the root cause. Say which domain it belongs to: Product, Test, Infrastructure, Environment/Data, Flaky/Timing or Unknown.`,
                `- Separate what the error and stack show from what you infer. State your confidence and what evidence is missing.`,
                `- If the fix belongs in this test file, finish your answer with the heading "${CORRECTED_FILE_HEADING}" followed by ONE fenced code block containing the COMPLETE corrected file.`,
                `- Make the smallest change. Do not remove or weaken assertions, skip tests, or add fixed waits such as waitForTimeout.`,
                `- If the cause is the product, the environment or the infrastructure, do not change the test. Omit the "${CORRECTED_FILE_HEADING}" section.`,
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
                '```',
            ].join('\n'),
        );
    }

    /**
     * Analyses a failed test and, when the model proposes one, validates a corrected file.
     *
     * @param failure - The test failure information
     * @param sourceCode - Map of source code files for context
     * @returns The analysis and saved file paths, or null when no analysis could be produced
     */
    static async generateFixSuggestion(
        failure: TestFailure,
        sourceCode: Map<string, string>,
    ): Promise<FixSuggestion | null> {
        if (!failure.testFile) {
            console.warn(`[GenAI] Cannot generate fix for test without file path: ${failure.testTitle}`);
            return null;
        }

        try {
            // Ensure the prompt and fixes directories exist
            const promptDir = path.join(process.cwd(), 'test-results', 'prompts');
            const fixesDir = path.join(process.cwd(), 'test-results', 'fixes');

            fs.mkdirSync(promptDir, {recursive: true});
            fs.mkdirSync(fixesDir, {recursive: true});

            // Read the source file content if not already in cache
            let source = sourceCode.get(failure.testFile);
            if (!source) {
                source = fs.readFileSync(failure.testFile, 'utf8');
                sourceCode.set(failure.testFile, source);
            }

            const promptContent = this.buildFixPrompt(failure, source);

            // Generate a clean filename for the test
            const safeFilename = this.sanitizeFilename(
                failure.testId ? `${failure.testId}` : `${path.basename(failure.testFile, '.ts')}-${failure.testTitle}`,
            );

            // Save the prompt
            const promptPath = path.join(promptDir, `${safeFilename}.md`);
            fs.writeFileSync(promptPath, promptContent, 'utf8');

            const response = await this.callGenAISuggestion(promptContent);

            // Save the response for review
            const fixPath = path.join(fixesDir, `fix-${safeFilename}.md`);
            fs.writeFileSync(fixPath, response, 'utf8');

            const {analysis, patchedSource} = parseFixResponse(response);
            const suggestion: FixSuggestion = {promptPath, fixPath, analysis};

            if (patchedSource !== undefined) {
                suggestion.patchedSource = patchedSource;
                suggestion.replacement = validateReplacement(source, patchedSource);
            }

            return suggestion;
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
