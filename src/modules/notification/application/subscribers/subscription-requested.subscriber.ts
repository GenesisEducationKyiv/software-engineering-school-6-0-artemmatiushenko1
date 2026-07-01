import {
  SubscriptionEventType,
  type SubscriptionRequestedEvent,
} from '../../../subscription/api/events.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import { buildConfirmUrl } from '../links.js';
import { subscriptionConfirmationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

export class SubscriptionRequestedSubscriber extends EventSubscriber<SubscriptionRequestedEvent> {
  readonly eventType = SubscriptionEventType.Requested;
  constructor(
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {
    super();
  }

  async handle(event: SubscriptionRequestedEvent): Promise<void> {
    const confirmUrl = buildConfirmUrl(
      this.appUrl,
      event.payload.confirmationToken,
    );
    const template = subscriptionConfirmationTemplate(
      event.payload.repo,
      confirmUrl,
    );

    await this.emailClient.sendEmail({
      to: event.payload.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
