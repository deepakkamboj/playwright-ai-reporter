import assert from 'node:assert/strict';
import test from 'node:test';
import {EmailNotificationProvider} from './EmailNotificationProvider';

test('redacts custom email subjects and bodies before sending', async () => {
    const sent: Array<{subject?: string; html?: string}> = [];
    const provider = new EmailNotificationProvider({
        host: 'localhost',
        port: 25,
        auth: {user: 'user', pass: 'pass'},
        from: 'reporter@example.test',
    });
    (provider as unknown as {transporter: {sendMail: (mail: unknown) => Promise<{messageId: string}>}}).transporter = {
        sendMail: async (mail) => {
            sent.push(mail as {subject?: string; html?: string});
            return {messageId: 'message-1'};
        },
    };
    const secret = 'email-secret-123456789';

    const result = await provider.sendCustomNotification(
        `failure ${secret}`,
        `password=${secret}; repeated ${secret}`,
        {recipients: ['qa@example.test']},
    );

    assert.equal(result.success, true);
    assert.doesNotMatch(JSON.stringify(sent), new RegExp(secret));
    assert.match(JSON.stringify(sent), /\*\*\*\*/);
});
