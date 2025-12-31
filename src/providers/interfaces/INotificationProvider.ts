/**
 * Interface for notification providers (Email, Slack, Teams, etc.)
 */

import {TestSummary, TestFailure} from '../../types';

export enum NotificationSeverity {
    Info = 'Info',
    Warning = 'Warning',
    Error = 'Error',
    Critical = 'Critical',
}

export interface NotificationOptions {
    recipients: string[];
    subject?: string;
    severity?: NotificationSeverity;
    includeDetails?: boolean;
    attachments?: string[];
}

export interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface NotificationDetails {
    subject: string;
    body: string;
    priority?: 'low' | 'normal' | 'high';
    recipients: string[];
    metadata?: Record<string, any>;
}

export interface INotificationProvider {
    /**
     * Send a notification about test results
     * @param summary - Test summary information
     * @param options - Notification options
     * @returns Result of the notification
     */
    sendTestSummary(summary: TestSummary, options: NotificationOptions): Promise<NotificationResult>;

    /**
     * Send notifications for test failures
     * @param failures - List of test failures
     * @param options - Notification options
     * @returns Result of the notification
     */
    sendTestFailures(failures: TestFailure[], options: NotificationOptions): Promise<NotificationResult>;

    /**
     * Send a custom notification
     * @param title - Notification title
     * @param message - Notification message
     * @param options - Notification options
     * @returns Result of the notification
     */
    sendCustomNotification(title: string, message: string, options: NotificationOptions): Promise<NotificationResult>;

    /**
     * Send a notification with custom details
     * @param notification - Notification details
     * @returns Result of the notification
     */
    sendNotification(notification: NotificationDetails): Promise<NotificationResult>;
}
