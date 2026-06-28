import type { NewReleaseDetectedEvent } from '../../../scanner/api/events.js';
import { buildUnsubscribeUrl } from '../links.js';
import { newReleaseNotificationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

export class NewReleaseDetectedSubscriber {
  constructor(
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {}

  async handle(event: NewReleaseDetectedEvent): Promise<void> {
    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      event.payload.unsubscribeToken,
    );
    const template = newReleaseNotificationTemplate(
      event.payload.repo,
      event.payload.tag,
      event.payload.releaseName,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: event.payload.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
