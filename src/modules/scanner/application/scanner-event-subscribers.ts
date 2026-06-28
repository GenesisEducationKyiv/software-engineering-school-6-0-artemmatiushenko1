import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../subscription/api/events.js';
import type { SubscriptionConfirmedEvent } from '../../subscription/api/events.js';
import type { SubscriptionDeactivatedEvent } from '../../subscription/api/events.js';
import type { MonitoredRepoRepository } from './ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../shared-kernel/transaction.js';
import { SubscriptionConfirmedSubscriber } from './subscribers/subscription-confirmed.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './subscribers/subscription-deactivated.subscriber.js';

export class ScannerEventSubscribers {
  constructor(
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  register(eventBus: EventBus): void {
    const subscriptionConfirmedSubscriber = new SubscriptionConfirmedSubscriber(
      this.monitoredRepoRepository,
      this.transactionManager,
    );
    const subscriptionDeactivatedSubscriber =
      new SubscriptionDeactivatedSubscriber(
        this.monitoredRepoRepository,
        this.transactionManager,
      );

    eventBus.subscribe(
      SubscriptionEventType.Confirmed,
      (event: SubscriptionConfirmedEvent) =>
        subscriptionConfirmedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Deactivated,
      (event: SubscriptionDeactivatedEvent) =>
        subscriptionDeactivatedSubscriber.handle(event),
    );
  }
}
