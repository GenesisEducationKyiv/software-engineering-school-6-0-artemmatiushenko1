import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../subscription/api/events.js';
import { ScannerEventType } from '../../scanner/api/events.js';
import type { EmailClient } from './ports/email-client.js';
import { NotificationEventSubscribers } from './notification-event-subscribers.js';

describe('NotificationEventSubscribers', () => {
  it('registers all notification event handlers on the event bus', () => {
    const eventBus = mock<EventBus>();
    const subscribers = new NotificationEventSubscribers(
      mock<EmailClient>(),
      'http://localhost:3000',
    );

    subscribers.register(eventBus);

    expect(eventBus.subscribe).toHaveBeenCalledTimes(5);
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Requested,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.ConfirmationRenewed,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Reactivated,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Confirmed,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      ScannerEventType.NewReleaseDetected,
      expect.any(Function),
    );
  });
});
