import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../subscription/api/events.js';
import type { MonitoredRepoRepository } from './ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../shared-kernel/transaction.js';
import { ScannerEventSubscribers } from './scanner-event-subscribers.js';

describe('ScannerEventSubscribers', () => {
  it('registers scanner event handlers on the event bus', () => {
    const eventBus = mock<EventBus>();
    const subscribers = new ScannerEventSubscribers(
      mock<MonitoredRepoRepository>(),
      mock<TransactionManager>(),
    );

    subscribers.register(eventBus);

    expect(eventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Confirmed,
      expect.any(Function),
    );
  });
});
