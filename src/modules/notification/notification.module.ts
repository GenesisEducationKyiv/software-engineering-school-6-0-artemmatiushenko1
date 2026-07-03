import type { Database } from '../../platform/db/types.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { DrizzleRecipientRepository } from './infrastructure/recipient.repository.js';
import { DrizzleIdempotencyGuard } from '../../platform/idempotency-guard/drizzle-idempotency-guard.js';
import type { DeliveredEvent } from '../../platform/event-bus/domain-event-envelope.js';
import type { EventSubscriber } from '../../platform/event-bus/event-subscriber.js';
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
  readonly eventSubscribers: EventSubscriber<DeliveredEvent>[];

  private readonly recipientRepository: DrizzleRecipientRepository;

  private constructor(deps: NotificationModuleDeps) {
    const idempotencyGuard = new DrizzleIdempotencyGuard(deps.db);
    this.recipientRepository = new DrizzleRecipientRepository(deps.db);
    this.eventSubscribers = [
      new SubscriptionRequestedSubscriber(
        idempotencyGuard,
        deps.emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmationRenewedSubscriber(
        idempotencyGuard,
        deps.emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionReactivatedSubscriber(
        idempotencyGuard,
        deps.emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmedSubscriber(
        idempotencyGuard,
        this.recipientRepository,
        deps.emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionDeactivatedSubscriber(this.recipientRepository),
      new NewReleaseDetectedSubscriber(
        idempotencyGuard,
        this.recipientRepository,
        deps.emailClient,
        deps.appUrl,
        deps.metrics,
      ),
    ];
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    return new NotificationModule(deps);
  }
}
