import {
    INotificationProvider,
    NotificationDetails,
    NotificationOptions,
    NotificationResult,
} from '../interfaces/INotificationProvider';
import {TestFailure, TestSummary} from '../../types';
import {redactObject, redactText, redactUrl, registerSecret} from '../../utils/redaction';
import {stripAnsi} from '../../utils/ansi';

export interface WebhookConfig {
    webhookUrl: string;
}

export interface ChatMessage {
    title: string;
    facts: Array<{name: string; value: string}>;
    details: string[];
    reportUrl?: string;
}

export function validateNotificationUrl(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be an HTTPS URL`);
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${label} must be an HTTPS URL`);
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
        throw new Error(`${label} must use HTTPS without user credentials or fragments`);
    }
    return url.href;
}

export function registerWebhookUrl(value: unknown, label: string): string {
    const normalized = validateNotificationUrl(value, label);
    if (typeof value === 'string') registerSecret(value);
    registerSecret(normalized);
    return normalized;
}

const text = (value: string, limit: number): string => {
    const safe = redactText(stripAnsi(value));
    const characters = Array.from(safe);
    return characters.length > limit ? `${characters.slice(0, limit - 3).join('')}...` : safe;
};

export abstract class WebhookNotificationProvider implements INotificationProvider {
    private readonly webhookUrl: string;

    constructor(
        protected readonly channel: 'Slack' | 'Teams',
        config: WebhookConfig,
    ) {
        this.webhookUrl = registerWebhookUrl(config.webhookUrl, `${channel} webhook URL`);
    }

    protected abstract createPayload(message: ChatMessage): Record<string, unknown>;

    async sendTestSummary(summary: TestSummary, options: NotificationOptions): Promise<NotificationResult> {
        const flaky = Math.min(summary.passedCount, Math.max(0, options.flakyCount ?? 0));
        const status = options.runStatus ?? (summary.failedCount ? 'failed' : 'passed');
        return this.deliver(
            {
                title: text(options.subject ?? `Test Health Report: ${status.toUpperCase()}`, 150),
                facts: [
                    {name: 'Total', value: String(summary.testCount)},
                    {name: 'Passed', value: String(summary.passedCount - flaky)},
                    {name: 'Failed', value: String(summary.failedCount)},
                    {name: 'Flaky', value: String(flaky)},
                    {name: 'Skipped', value: String(summary.skippedCount)},
                    {name: 'Duration', value: text(summary.totalTimeDisplay, 100)},
                ],
                details: options.includeDetails === false ? [] : this.failureTitles(summary.failures),
            },
            options,
        );
    }

    async sendTestFailures(failures: TestFailure[], options: NotificationOptions): Promise<NotificationResult> {
        return this.deliver(
            {
                title: text(options.subject ?? `Test failures: ${failures.length}`, 150),
                facts: [],
                details: options.includeDetails === false ? [] : this.failureTitles(failures),
            },
            options,
        );
    }

    async sendCustomNotification(
        title: string,
        message: string,
        options: NotificationOptions,
    ): Promise<NotificationResult> {
        return this.deliver({title: text(title, 150), facts: [], details: [text(message, 2000)]}, options);
    }

    async sendNotification(notification: NotificationDetails): Promise<NotificationResult> {
        return this.sendCustomNotification(notification.subject, notification.body, {
            recipients: notification.recipients,
        });
    }

    private failureTitles(failures: TestFailure[]): string[] {
        const titles = failures.slice(0, 5).map((failure) => text(failure.testTitle, 200));
        if (failures.length > 5) titles.push(`... and ${failures.length - 5} more failed tests`);
        return titles;
    }

    private failed(reason: string): NotificationResult {
        const error = `${this.channel} notification failed: ${reason}`;
        console.error(error);
        return {success: false, error};
    }

    private async deliver(message: ChatMessage, options: NotificationOptions): Promise<NotificationResult> {
        if (options.attachments?.length) return this.failed('webhook file uploads are not supported');
        try {
            if (options.reportUrl) {
                message.reportUrl = redactUrl(validateNotificationUrl(options.reportUrl, 'Report URL'));
            }
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(redactObject(this.createPayload(message))),
                redirect: 'error',
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) {
                await response.body?.cancel();
                return this.failed(`HTTP ${response.status}`);
            }
            if (this.channel === 'Slack' && (await response.text()).trim() !== 'ok') {
                return this.failed('webhook did not acknowledge the message');
            }
            if (this.channel === 'Teams') await response.body?.cancel();
            return {success: true};
        } catch (cause) {
            if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
                return this.failed('request timed out after 10 seconds');
            }
            // HTTP-client errors may contain the secret webhook URL or request body.
            return this.failed('request could not be completed; check webhook configuration and connectivity');
        }
    }
}
