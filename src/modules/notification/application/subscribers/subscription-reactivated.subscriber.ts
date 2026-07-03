import {
  SubscriptionEventType,
  type SubscriptionReactivatedEvent,
} from '../../../subscription/api/events.js';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { IdempotentSubscriber } from '../../../../platform/idempotency-guard/idempotent.subscriber.js';
import { buildConfirmUrl } from '../links.js';
import { subscriptionConfirmationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

export class SubscriptionReactivatedSubscriber extends IdempotentSubscriber<
  Delivered<SubscriptionReactivatedEvent>
> {
  readonly eventType = SubscriptionEventType.Reactivated;
  constructor(
    idempotencyGuard: IdempotencyGuard,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {
    super(idempotencyGuard);
  }

  protected readonly name = 'notification:subscription-reactivated';

  async handle(event: Delivered<SubscriptionReactivatedEvent>): Promise<void> {
    await this.claimAndRun(event, () => this.deliver(event));
  }

  private async deliver(
    event: Delivered<SubscriptionReactivatedEvent>,
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

    this.metrics?.incrementNotificationsSent();
  }
}
