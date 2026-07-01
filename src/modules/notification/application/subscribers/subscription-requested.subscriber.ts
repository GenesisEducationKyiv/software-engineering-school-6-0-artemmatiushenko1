import {
  SubscriptionEventType,
  type SubscriptionRequestedEvent,
} from '../../../subscription/api/events.js';
import type { DeliveryDedup } from '../../../../platform/delivery-dedup/delivery-dedup.js';
import { buildConfirmUrl } from '../links.js';
import { subscriptionConfirmationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import { IdempotentEmailSubscriber } from './idempotent-email.subscriber.js';

export class SubscriptionRequestedSubscriber extends IdempotentEmailSubscriber<SubscriptionRequestedEvent> {
  readonly eventType = SubscriptionEventType.Requested;
  constructor(
    deliveryDedup: DeliveryDedup,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {
    super(deliveryDedup);
  }

  protected async deliver(event: SubscriptionRequestedEvent): Promise<void> {
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
