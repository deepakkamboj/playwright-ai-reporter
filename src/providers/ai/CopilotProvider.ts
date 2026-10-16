/**
 * GitHub Copilot AI provider.
 *
 * Calls the GitHub Copilot CLI in non-interactive mode. In GitHub Actions it authenticates with the
 * workflow's short-lived GITHUB_TOKEN (the job needs `permissions: copilot-requests: write`), so no
 * model API key is stored. Locally it uses the CLI's existing login or GH_TOKEN / GITHUB_TOKEN.
 *
 * The CLI is started with every tool disabled, so the model can only return text. The prompt is
 * sent on stdin, which avoids command-line length limits and keeps it out of process listings.
 */

import {spawn} from 'child_process';
import {IAIProvider, AIMessage, AIModelConfig, AIResponse} from '../interfaces/IAIProvider';
import {redactMessages, redactText} from '../../utils/redaction';

export interface CliRunOptions {
    timeoutMs: number;
    env: NodeJS.ProcessEnv;
}

export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

/** Runs a command, writes `input` to its stdin and resolves with the captured output. */
export type CliRunner = (command: string, args: string[], input: string, options: CliRunOptions) => Promise<CliResult>;

const SAFE_ARGUMENT = /^[A-Za-z0-9._:/@-]+$/;

const DEFAULT_TIMEOUT_MS = 300_000;
const VERSION_TIMEOUT_MS = 30_000;

/** Arguments that make a call text-only: no tools, MCP servers, custom instructions or prompts. */
export const COPILOT_TEXT_ONLY_ARGS = [
    '--silent',
    '--no-color',
    '--no-ask-user',
    '--no-custom-instructions',
    '--disable-builtin-mcps',
    '--available-tools',
];

function quoteForShell(value: string): string {
    return `"${value.replace(/"/g, '')}"`;
}

export const defaultCliRunner: CliRunner = (command, args, input, options) =>
    new Promise((resolve, reject) => {
        // On Windows the CLI may be a .cmd shim, which can only be started through a shell. The
        // arguments are constants or validated against SAFE_ARGUMENT, and the prompt goes on stdin.
        const useShell = process.platform === 'win32';
        const child = useShell
            ? spawn([quoteForShell(command), ...args].join(' '), {shell: true, env: options.env})
            : spawn(command, args, {env: options.env});

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, options.timeoutMs);

        child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
        child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));

        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });

        child.on('close', (exitCode) => {
            clearTimeout(timer);
            if (timedOut) {
                reject(new Error(`Copilot CLI timed out after ${options.timeoutMs} ms`));
                return;
            }
            resolve({stdout, stderr, exitCode});
        });

        child.stdin?.on('error', () => undefined);
        child.stdin?.end(input);
    });

export class CopilotProvider implements IAIProvider {
    private readonly command: string;
    private readonly defaultModel: string | undefined;
    private readonly timeoutMs: number;

    constructor(private readonly runner: CliRunner = defaultCliRunner) {
        this.command = process.env.COPILOT_CLI_PATH || 'copilot';
        this.defaultModel = process.env.COPILOT_MODEL || undefined;
        this.timeoutMs = Number(process.env.COPILOT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    }

    getName(): string {
        return 'GitHub Copilot';
    }

    async initialize(): Promise<void> {
        let result: CliResult;
        try {
            result = await this.runner(this.command, ['--version'], '', {
                timeoutMs: VERSION_TIMEOUT_MS,
                env: process.env,
            });
        } catch (error) {
            throw new Error(this.notAvailableMessage(error instanceof Error ? error.message : String(error)));
        }

        if (result.exitCode !== 0) {
            throw new Error(this.notAvailableMessage(result.stderr.trim() || `exit code ${result.exitCode}`));
        }
    }

    async generateCompletion(messages: AIMessage[], config?: AIModelConfig): Promise<AIResponse> {
        const model = config?.model || this.defaultModel;
        if (model && !SAFE_ARGUMENT.test(model)) {
            throw new Error(`Invalid Copilot model name: ${model}`);
        }

        const args = [...COPILOT_TEXT_ONLY_ARGS];
        if (model) {
            args.push('--model', model);
        }

        const result = await this.runner(this.command, args, this.formatPrompt(redactMessages(messages), config), {
            timeoutMs: this.timeoutMs,
            env: process.env,
        });

        if (result.exitCode !== 0) {
            const detail = redactText(result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`);
            throw new Error(`Copilot CLI failed: ${detail}`);
        }

        const content = redactText(result.stdout.trim());
        if (!content) {
            throw new Error('Copilot CLI returned an empty response');
        }

        return {content, model};
    }

    async generateText(prompt: string, config?: AIModelConfig): Promise<string> {
        const response = await this.generateCompletion([{role: 'user', content: prompt}], config);
        return response.content;
    }

    async testConnection(): Promise<boolean> {
        try {
            const reply = await this.generateText('Reply with the single word PONG and nothing else.');
            return reply.toUpperCase().includes('PONG');
        } catch (error) {
            console.error('[Copilot] Connection test failed:', error);
            return false;
        }
    }

    /**
     * The CLI has no system role, so messages are concatenated in order. The CLI also ignores
     * temperature and token limits, so those settings have no effect for this provider.
     */
    private formatPrompt(messages: AIMessage[], config?: AIModelConfig): string {
        const parts = messages.map((message) =>
            message.role === 'assistant' ? `Assistant: ${message.content}` : message.content,
        );

        if (config?.responseFormat === 'json') {
            parts.push('Respond with a single valid JSON object and nothing else.');
        }

        return parts.join('\n\n');
    }

    private notAvailableMessage(detail: string): string {
        return (
            `GitHub Copilot CLI is not available (${detail}). Install it with ` +
            `"npm install -g @github/copilot", set COPILOT_CLI_PATH, and authenticate with GITHUB_TOKEN ` +
            `(in GitHub Actions add "permissions: copilot-requests: write").`
        );
    }
}
