import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { registerEventSubscribers } from '../../../platform/event-bus/event-subscriber.js';
import type { EmailClient } from './ports/email-client.js';
import type { NotificationMetrics } from './ports/notification-metrics.js';
import type { RecipientRepository } from './ports/recipient.repository.js';
import { SubscriptionRequestedSubscriber } from './subscribers/subscription-requested.subscriber.js';
import { SubscriptionConfirmationRenewedSubscriber } from './subscribers/subscription-confirmation-renewed.subscriber.js';
import { SubscriptionReactivatedSubscriber } from './subscribers/subscription-reactivated.subscriber.js';
import { SubscriptionConfirmedSubscriber } from './subscribers/subscription-confirmed.subscriber.js';
import { NewReleaseDetectedSubscriber } from './subscribers/new-release-detected.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './subscribers/subscription-deactivated.subscriber.js';

export class NotificationEventSubscribers {
  constructor(
    private readonly recipientRepository: RecipientRepository,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {}

  register(eventBus: EventBus): void {
    registerEventSubscribers(eventBus, [
      new SubscriptionRequestedSubscriber(
        this.emailClient,
        this.appUrl,
        this.metrics,
      ),
      new SubscriptionConfirmationRenewedSubscriber(
        this.emailClient,
        this.appUrl,
        this.metrics,
      ),
      new SubscriptionReactivatedSubscriber(
        this.emailClient,
        this.appUrl,
        this.metrics,
      ),
      new SubscriptionConfirmedSubscriber(
        this.recipientRepository,
        this.emailClient,
        this.appUrl,
        this.metrics,
      ),
      new SubscriptionDeactivatedSubscriber(this.recipientRepository),
      new NewReleaseDetectedSubscriber(
        this.recipientRepository,
        this.emailClient,
        this.appUrl,
        this.metrics,
      ),
    ]);
  }
}
