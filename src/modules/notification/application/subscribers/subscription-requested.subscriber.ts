import {
  SubscriptionEventType,
  type SubscriptionRequestedEvent,
} from '../../../subscription/api/events.js';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { IdempotentSubscriber } from '../../../../platform/idempotency-guard/idempotent.subscriber.js';
import { buildConfirmUrl } from '../links.js';
import { subscriptionConfirmationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

export class SubscriptionRequestedSubscriber extends IdempotentSubscriber<SubscriptionRequestedEvent> {
  protected readonly name = 'notification:subscription-requested';
  readonly eventType = SubscriptionEventType.Requested;

  constructor(
    idempotencyGuard: IdempotencyGuard,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics: NotificationMetrics,
  ) {
    super(idempotencyGuard);
  }

  async handle(event: Delivered<SubscriptionRequestedEvent>): Promise<void> {
    await this.runIfNotProcessed(event, () => this.sendNotification(event));
  }

  private async sendNotification(
    event: Delivered<SubscriptionRequestedEvent>,
  ): Promise<void> {
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

    this.metrics.incrementNotificationsSent();
  }
}
