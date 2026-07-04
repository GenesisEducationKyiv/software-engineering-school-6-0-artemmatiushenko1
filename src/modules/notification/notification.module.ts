import type { EmailConfig } from './config.js';
import type { NotificationService } from './api/notification.service.js';
import { NotificationServiceImpl } from './application/notification.service.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { NodemailerEmailClient } from './infrastructure/nodemailer-email-client.js';

export type NotificationModuleDeps = {
  appUrl: string;
  metrics: NotificationMetrics;
  emailClient:
    | {
        source: 'client';
        instance: EmailClient;
      }
    | {
        source: 'config';
        config: EmailConfig;
      };
};
export class NotificationModule {
  readonly notificationService: NotificationService;

  private constructor(
    emailClient: EmailClient,
    appUrl: string,
    metrics: NotificationMetrics,
  ) {
    this.notificationService = new NotificationServiceImpl(
      emailClient,
      appUrl,
      metrics,
    );
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    const emailClient =
      deps.emailClient.source === 'client'
        ? deps.emailClient.instance
        : new NodemailerEmailClient(deps.emailClient.config);

    return new NotificationModule(emailClient, deps.appUrl, deps.metrics);
  }
}
