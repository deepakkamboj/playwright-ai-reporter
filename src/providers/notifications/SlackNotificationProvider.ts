import {ChatMessage, WebhookConfig, WebhookNotificationProvider} from './WebhookNotificationProvider';

export class SlackNotificationProvider extends WebhookNotificationProvider {
    constructor(config: WebhookConfig) {
        super('Slack', config);
    }

    protected createPayload(message: ChatMessage): Record<string, unknown> {
        return {
            text: message.title,
            mrkdwn: false,
            blocks: [
                {type: 'header', text: {type: 'plain_text', text: message.title}},
                ...(message.facts.length
                    ? [
                          {
                              type: 'section',
                              fields: message.facts.map(({name, value}) => ({
                                  type: 'plain_text',
                                  text: `${name}: ${value}`,
                              })),
                          },
                      ]
                    : []),
                ...message.details.map((detail) => ({
                    type: 'section',
                    text: {type: 'plain_text', text: detail || '(empty message)'},
                })),
                ...(message.reportUrl
                    ? [
                          {
                              type: 'actions',
                              elements: [
                                  {
                                      type: 'button',
                                      text: {type: 'plain_text', text: 'Open Test Health Report'},
                                      url: message.reportUrl,
                                  },
                              ],
                          },
                      ]
                    : []),
            ],
        };
    }
}
