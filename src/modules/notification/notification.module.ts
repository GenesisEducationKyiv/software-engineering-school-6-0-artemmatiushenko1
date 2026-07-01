import type { Database } from '../../platform/db/types.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { DrizzleRecipientRepository } from './infrastructure/recipient.repository.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';
import { registerEventSubscribers } from '../../platform/event-bus/event-subscriber.js';
import { SubscriptionRequestedSubscriber } from './application/subscribers/subscription-requested.subscriber.js';
import { SubscriptionConfirmationRenewedSubscriber } from './application/subscribers/subscription-confirmation-renewed.subscriber.js';
import { SubscriptionReactivatedSubscriber } from './application/subscribers/subscription-reactivated.subscriber.js';
import { SubscriptionConfirmedSubscriber } from './application/subscribers/subscription-confirmed.subscriber.js';
import { NewReleaseDetectedSubscriber } from './application/subscribers/new-release-detected.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './application/subscribers/subscription-deactivated.subscriber.js';

export interface NotificationModuleDeps {
  db: Database;
  emailClient: EmailClient;
  appUrl: string;
  metrics?: NotificationMetrics;
}

export class NotificationModule {
  private readonly recipientRepository: DrizzleRecipientRepository;

  private constructor(private readonly deps: NotificationModuleDeps) {
    this.recipientRepository = new DrizzleRecipientRepository(deps.db);
  }

  registerEventSubscribers(eventBus: EventBus): void {
    registerEventSubscribers(eventBus, [
      new SubscriptionRequestedSubscriber(
        this.deps.emailClient,
        this.deps.appUrl,
        this.deps.metrics,
      ),
      new SubscriptionConfirmationRenewedSubscriber(
        this.deps.emailClient,
        this.deps.appUrl,
        this.deps.metrics,
      ),
      new SubscriptionReactivatedSubscriber(
        this.deps.emailClient,
        this.deps.appUrl,
        this.deps.metrics,
      ),
      new SubscriptionConfirmedSubscriber(
        this.recipientRepository,
        this.deps.emailClient,
        this.deps.appUrl,
        this.deps.metrics,
      ),
      new SubscriptionDeactivatedSubscriber(this.recipientRepository),
      new NewReleaseDetectedSubscriber(
        this.recipientRepository,
        this.deps.emailClient,
        this.deps.appUrl,
        this.deps.metrics,
      ),
    ]);
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    return new NotificationModule(deps);
  }
}
