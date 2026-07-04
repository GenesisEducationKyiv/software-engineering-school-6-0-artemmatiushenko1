import type { Database } from '../../platform/db/types.js';
import type { EmailConfig } from './config.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { DrizzleRecipientRepository } from './infrastructure/recipient.repository.js';
import type { DomainEventEnvelope } from '../../platform/event-bus/domain-event-envelope.js';
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
  metrics?: NotificationMetrics;
} & (
  | {
      kind: 'client';
      emailClient: EmailClient;
    }
  | {
      kind: 'config';
      config: EmailConfig;
    }
);

export class NotificationModule {
  readonly eventSubscribers: EventSubscriber<DomainEventEnvelope>[];

  private readonly recipientRepository: DrizzleRecipientRepository;

  private constructor(deps: NotificationModuleDeps, emailClient: EmailClient) {
    this.recipientRepository = new DrizzleRecipientRepository(deps.db);
    this.eventSubscribers = [
      new SubscriptionRequestedSubscriber(
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmationRenewedSubscriber(
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionReactivatedSubscriber(
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionConfirmedSubscriber(
        this.recipientRepository,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
      new SubscriptionDeactivatedSubscriber(this.recipientRepository),
      new NewReleaseDetectedSubscriber(
        this.recipientRepository,
        emailClient,
        deps.appUrl,
        deps.metrics,
      ),
    ];
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    const emailClient =
      deps.kind === 'client'
        ? deps.emailClient
        : new NodemailerEmailClient(deps.config);

    return new NotificationModule(deps, emailClient);
  }
}
