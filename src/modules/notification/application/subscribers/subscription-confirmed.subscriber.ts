import type { SubscriptionConfirmedEvent } from '../../../subscription/api/events.js';
import { buildUnsubscribeUrl } from '../../infrastructure/links.js';
import { subscriptionConfirmedTemplate } from '../../infrastructure/templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

export class SubscriptionConfirmedSubscriber {
  constructor(
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {}

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      event.payload.unsubscribeToken,
    );
    const template = subscriptionConfirmedTemplate(
      event.payload.repo,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: event.payload.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
