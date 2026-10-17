import {ChatMessage, WebhookConfig, WebhookNotificationProvider} from './WebhookNotificationProvider';

const escapeMarkdown = (value: string): string => value.replace(/[\\`*_[\]()<>]/g, '\\$&');

export class TeamsNotificationProvider extends WebhookNotificationProvider {
    constructor(config: WebhookConfig) {
        super('Teams', config);
    }

    protected createPayload(message: ChatMessage): Record<string, unknown> {
        return {
            type: 'message',
            attachments: [
                {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    contentUrl: null,
                    content: {
                        $schema: 'https://adaptivecards.io/schemas/adaptive-card.json',
                        type: 'AdaptiveCard',
                        version: '1.2',
                        body: [
                            {
                                type: 'TextBlock',
                                text: escapeMarkdown(message.title),
                                weight: 'Bolder',
                                size: 'Large',
                                wrap: true,
                            },
                            ...(message.facts.length
                                ? [
                                      {
                                          type: 'FactSet',
                                          facts: message.facts.map(({name, value}) => ({title: name, value})),
                                      },
                                  ]
                                : []),
                            ...message.details.map((detail) => ({
                                type: 'TextBlock',
                                text: escapeMarkdown(detail),
                                wrap: true,
                            })),
                        ],
                        ...(message.reportUrl
                            ? {
                                  actions: [
                                      {
                                          type: 'Action.OpenUrl',
                                          title: 'Open Test Health Report',
                                          url: message.reportUrl,
                                      },
                                  ],
                              }
                            : {}),
                    },
                },
            ],
        };
    }
}
