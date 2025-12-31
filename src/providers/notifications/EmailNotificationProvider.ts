/**
 * Email Notification Provider
 */

import nodemailer from 'nodemailer';
import {
    INotificationProvider,
    NotificationOptions,
    NotificationResult,
    NotificationSeverity,
} from '../interfaces/INotificationProvider';
import {TestSummary, TestFailure} from '../../types';

export interface EmailConfig {
    host: string;
    port: number;
    secure?: boolean; // true for 465, false for other ports
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}

export class EmailNotificationProvider implements INotificationProvider {
    private transporter: nodemailer.Transporter;
    private config: EmailConfig;

    constructor(config: EmailConfig) {
        this.config = config;
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure ?? false,
            auth: config.auth,
        });
    }

    async sendTestSummary(summary: TestSummary, options: NotificationOptions): Promise<NotificationResult> {
        try {
            const subject = options.subject || this.generateSummarySubject(summary);
            const html = this.generateSummaryHtml(summary);

            const info = await this.transporter.sendMail({
                from: this.config.from,
                to: options.recipients.join(', '),
                subject,
                html,
                attachments: options.attachments?.map((path) => ({path})),
            });

            console.log('Email sent:', info.messageId);

            return {
                success: true,
                messageId: info.messageId,
            };
        } catch (error: any) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async sendTestFailures(failures: TestFailure[], options: NotificationOptions): Promise<NotificationResult> {
        try {
            const subject = options.subject || `Test Failures: ${failures.length} test(s) failed`;
            const html = this.generateFailuresHtml(failures);

            const info = await this.transporter.sendMail({
                from: this.config.from,
                to: options.recipients.join(', '),
                subject,
                html,
                attachments: options.attachments?.map((path) => ({path})),
            });

            console.log('Email sent:', info.messageId);

            return {
                success: true,
                messageId: info.messageId,
            };
        } catch (error: any) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async sendCustomNotification(
        title: string,
        message: string,
        options: NotificationOptions,
    ): Promise<NotificationResult> {
        try {
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">${title}</h2>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                        <p style="white-space: pre-wrap;">${message}</p>
                    </div>
                    ${this.getEmailFooter()}
                </div>
            `;

            const info = await this.transporter.sendMail({
                from: this.config.from,
                to: options.recipients.join(', '),
                subject: title,
                html,
                attachments: options.attachments?.map((path) => ({path})),
            });

            console.log('Email sent:', info.messageId);

            return {
                success: true,
                messageId: info.messageId,
            };
        } catch (error: any) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async sendNotification(
        notification: import('../interfaces/INotificationProvider').NotificationDetails,
    ): Promise<NotificationResult> {
        try {
            const severity = notification.priority || 'normal';
            const color = severity === 'high' ? '#d32f2f' : severity === 'low' ? '#1976d2' : '#f57c00';

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">${notification.subject}</h2>
                    </div>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                        <div style="white-space: pre-wrap;">${notification.body}</div>
                    </div>
                    ${this.getEmailFooter()}
                </div>
            `;

            const info = await this.transporter.sendMail({
                from: this.config.from,
                to: notification.recipients.join(', '),
                subject: notification.subject,
                html,
            });

            console.log('Email sent:', info.messageId);

            return {
                success: true,
                messageId: info.messageId,
            };
        } catch (error: any) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    private generateSummarySubject(summary: TestSummary): string {
        const status = summary.failedCount > 0 ? '❌ FAILED' : '✅ PASSED';
        return `Test Run ${status}: ${summary.passedCount}/${summary.testCount} passed`;
    }

    private generateSummaryHtml(summary: TestSummary): string {
        const passRate = ((summary.passedCount / summary.testCount) * 100).toFixed(1);
        const statusColor = summary.failedCount > 0 ? '#d32f2f' : '#388e3c';

        let html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Test Run Summary</h1>
                </div>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Tests:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${summary.testCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Passed:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #388e3c;">${summary.passedCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Failed:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #d32f2f;">${summary.failedCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Skipped:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${summary.skippedCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Pass Rate:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${passRate}%</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;"><strong>Duration:</strong></td>
                            <td style="padding: 10px;">${summary.totalTimeDisplay}</td>
                        </tr>
                    </table>
        `;

        if (summary.buildInfo) {
            html += `
                <h3 style="margin-top: 20px;">Build Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
            `;

            if (summary.buildInfo.buildNumber) {
                html += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Build:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${summary.buildInfo.buildNumber}</td>
                    </tr>
                `;
            }

            if (summary.buildInfo.buildBranch) {
                html += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Branch:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${summary.buildInfo.buildBranch}</td>
                    </tr>
                `;
            }

            if (summary.buildInfo.commitId) {
                html += `
                    <tr>
                        <td style="padding: 10px;"><strong>Commit:</strong></td>
                        <td style="padding: 10px;">${summary.buildInfo.commitId.substring(0, 8)}</td>
                    </tr>
                `;
            }

            html += `</table>`;
        }

        if (summary.failures.length > 0) {
            html += `
                <h3 style="margin-top: 20px; color: #d32f2f;">Failed Tests</h3>
                <ul style="list-style-type: none; padding: 0;">
            `;

            summary.failures.forEach((failure) => {
                html += `
                    <li style="background-color: white; margin-bottom: 10px; padding: 10px; border-left: 4px solid #d32f2f; border-radius: 3px;">
                        <strong>${failure.testTitle}</strong><br/>
                        <small style="color: #666;">${failure.suiteTitle}</small><br/>
                        <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 12px;">${this.escapeHtml(failure.errorMessage)}</pre>
                    </li>
                `;
            });

            html += `</ul>`;
        }

        html += `
                </div>
                ${this.getEmailFooter()}
            </div>
        `;

        return html;
    }

    private generateFailuresHtml(failures: TestFailure[]): string {
        let html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #d32f2f; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Test Failures Report</h1>
                    <p style="margin: 10px 0 0 0;">${failures.length} test(s) failed</p>
                </div>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
        `;

        failures.forEach((failure, index) => {
            html += `
                <div style="background-color: white; margin-bottom: 20px; padding: 15px; border-left: 4px solid #d32f2f; border-radius: 3px;">
                    <h3 style="margin-top: 0; color: #333;">${index + 1}. ${failure.testTitle}</h3>
                    <p style="margin: 5px 0; color: #666;"><strong>Suite:</strong> ${failure.suiteTitle}</p>
                    ${failure.testFile ? `<p style="margin: 5px 0; color: #666;"><strong>File:</strong> ${failure.testFile}</p>` : ''}
                    ${failure.owningTeam ? `<p style="margin: 5px 0; color: #666;"><strong>Team:</strong> ${failure.owningTeam}</p>` : ''}
                    <p style="margin: 5px 0; color: #666;"><strong>Category:</strong> ${failure.errorCategory}</p>
                    <p style="margin: 10px 0 5px 0;"><strong>Error:</strong></p>
                    <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 12px; border-radius: 3px;">${this.escapeHtml(failure.errorMessage)}</pre>
            `;

            if (failure.errorStack) {
                html += `
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #1976d2;">View Stack Trace</summary>
                        <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 11px; border-radius: 3px; margin-top: 10px;">${this.escapeHtml(failure.errorStack)}</pre>
                    </details>
                `;
            }

            html += `</div>`;
        });

        html += `
                </div>
                ${this.getEmailFooter()}
            </div>
        `;

        return html;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private getEmailFooter(): string {
        return `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                <p style="margin: 5px 0;">📧 This email was generated by <strong style="color: #1976d2;">Playwright Smart Reporter</strong></p>
                <p style="margin: 5px 0;">AI-powered test reporting with intelligent failure analysis</p>
                <p style="margin: 5px 0;">
                    <a href="https://github.com/deepakkamboj/playwright-ai-reporter" style="color: #1976d2; text-decoration: none;">GitHub</a> |
                    <a href="https://www.npmjs.com/package/playwright-ai-reporter" style="color: #1976d2; text-decoration: none;">npm</a>
                </p>
            </div>
        `;
    }
}

