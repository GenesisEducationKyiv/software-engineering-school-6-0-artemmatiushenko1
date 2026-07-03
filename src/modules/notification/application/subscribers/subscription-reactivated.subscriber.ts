import {
  SubscriptionEventType,
  type SubscriptionReactivatedEvent,
} from '../../../subscription/api/events.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { buildConfirmUrl } from '../links.js';
import { subscriptionConfirmationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import { IdempotentEmailSubscriber } from './idempotent-email.subscriber.js';

export class SubscriptionReactivatedSubscriber extends IdempotentEmailSubscriber<SubscriptionReactivatedEvent> {
  readonly eventType = SubscriptionEventType.Reactivated;
  constructor(
    idempotencyGuard: IdempotencyGuard,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {
    super(idempotencyGuard, 'notification:subscription-reactivated');
  }

  protected async deliver(event: SubscriptionReactivatedEvent): Promise<void> {
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
