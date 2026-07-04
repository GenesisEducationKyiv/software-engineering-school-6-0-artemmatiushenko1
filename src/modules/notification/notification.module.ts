import type { Database } from '../../platform/db/types.js';
import type { EmailConfig } from './config.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { DrizzleRecipientRepository } from './infrastructure/recipient.repository.js';
import { DrizzleIdempotencyGuard } from '../../platform/idempotency-guard/drizzle-idempotency-guard.js';
import type {
  Delivered,
  IntegrationEvent,
} from '../../platform/event-bus/domain-event-envelope.js';
import type { EventSubscriber } from '../../platform/event-bus/event-subscriber.js';
import { SubscriptionRequestedSubscriber } from './application/subscribers/subscription-requested.subscriber.js';
import { SubscriptionConfirmationRenewedSubscriber } from './application/subscribers/subscription-confirmation-renewed.subscriber.js';
import { SubscriptionReactivatedSubscriber } from './application/subscribers/subscription-reactivated.subscriber.js';
import { SubscriptionConfirmedSubscriber } from './application/subscribers/subscription-confirmed.subscriber.js';
import { NewReleaseDetectedSubscriber } from './application/subscribers/new-release-detected.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './application/subscribers/subscription-deactivated.subscriber.js';
import { NodemailerEmailClient } from './infrastructure/nodemailer-email-client.js';

export type NotificationModuleDeps = {
  db: Database;
  appUrl: string;
  metrics: NotificationMetrics;
  emailClient:
    | {
        source: 'client';
        instance: EmailClient;
      }
    | {
        source: 'config';
        config: EmailConfig;
      };
};
export class NotificationModule {
  readonly eventSubscribers: EventSubscriber<Delivered<IntegrationEvent>>[];

  private readonly recipientRepository: DrizzleRecipientRepository;

  private constructor(deps: NotificationModuleDeps, emailClient: EmailClient) {
    const idempotencyGuard = new DrizzleIdempotencyGuard(deps.db);
    this.recipientRepository = new DrizzleRecipientRepository(deps.db);
    this.eventSubscribers = [
      new SubscriptionRequestedSubscriber(
        idempotencyGuard,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmationRenewedSubscriber(
        idempotencyGuard,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionReactivatedSubscriber(
        idempotencyGuard,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmedSubscriber(
        idempotencyGuard,
        this.recipientRepository,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionDeactivatedSubscriber(this.recipientRepository),
      new NewReleaseDetectedSubscriber(
        idempotencyGuard,
        this.recipientRepository,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
    ];
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    const emailClient =
      deps.emailClient.source === 'client'
        ? deps.emailClient.instance
        : new NodemailerEmailClient(deps.emailClient.config);

    return new NotificationModule(deps, emailClient);
  }
}
