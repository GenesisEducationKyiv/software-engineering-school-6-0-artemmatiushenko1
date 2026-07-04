import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';
import { registerEventSubscribers } from '../../platform/event-bus/event-subscriber.js';
import { SubscriptionEventType } from '../subscription/api/events.js';
import { ScannerEventType } from '../scanner/api/events.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { Database } from '../../platform/db/types.js';
import { NotificationModule } from './notification.module.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';

describe('NotificationModule', () => {
  it('registers all notification event handlers on the event bus', () => {
    const eventBus = mock<EventBus>();
    const module = NotificationModule.create({
      metrics: mock<NotificationMetrics>(),
      db: mock<Database>(),
      appUrl: 'http://localhost:3000',
      emailClient: { source: 'client', instance: mock<EmailClient>() },
    });

    registerEventSubscribers(eventBus, module.eventSubscribers);

    expect(eventBus.subscribe).toHaveBeenCalledTimes(6);
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
      SubscriptionEventType.Deactivated,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      ScannerEventType.NewReleaseDetected,
      expect.any(Function),
    );
  });
});
