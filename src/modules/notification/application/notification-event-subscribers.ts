import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../subscription/api/events.js';
import type { SubscriptionRequestedEvent } from '../../subscription/api/events.js';
import type { SubscriptionConfirmationRenewedEvent } from '../../subscription/api/events.js';
import type { SubscriptionReactivatedEvent } from '../../subscription/api/events.js';
import type { SubscriptionConfirmedEvent } from '../../subscription/api/events.js';
import type { SubscriptionDeactivatedEvent } from '../../subscription/api/events.js';
import { ScannerEventType } from '../../scanner/api/events.js';
import type { NewReleaseDetectedEvent } from '../../scanner/api/events.js';
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
    const subscriptionDeactivatedProjectionSubscriber =
      new SubscriptionDeactivatedSubscriber(this.recipientRepository);

    const subscriptionRequestedSubscriber = new SubscriptionRequestedSubscriber(
      this.emailClient,
      this.appUrl,
      this.metrics,
    );
    const subscriptionConfirmationRenewedSubscriber =
      new SubscriptionConfirmationRenewedSubscriber(
        this.emailClient,
        this.appUrl,
        this.metrics,
      );
    const subscriptionReactivatedSubscriber =
      new SubscriptionReactivatedSubscriber(
        this.emailClient,
        this.appUrl,
        this.metrics,
      );
    const subscriptionConfirmedSubscriber = new SubscriptionConfirmedSubscriber(
      this.recipientRepository,
      this.emailClient,
      this.appUrl,
      this.metrics,
    );
    const newReleaseDetectedSubscriber = new NewReleaseDetectedSubscriber(
      this.recipientRepository,
      this.emailClient,
      this.appUrl,
      this.metrics,
    );

    eventBus.subscribe(
      SubscriptionEventType.Requested,
      (event: SubscriptionRequestedEvent) =>
        subscriptionRequestedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.ConfirmationRenewed,
      (event: SubscriptionConfirmationRenewedEvent) =>
        subscriptionConfirmationRenewedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Reactivated,
      (event: SubscriptionReactivatedEvent) =>
        subscriptionReactivatedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Confirmed,
      (event: SubscriptionConfirmedEvent) =>
        subscriptionConfirmedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Deactivated,
      (event: SubscriptionDeactivatedEvent) =>
        subscriptionDeactivatedProjectionSubscriber.handle(event),
    );

    eventBus.subscribe(
      ScannerEventType.NewReleaseDetected,
      (event: NewReleaseDetectedEvent) =>
        newReleaseDetectedSubscriber.handle(event),
    );
  }
}
