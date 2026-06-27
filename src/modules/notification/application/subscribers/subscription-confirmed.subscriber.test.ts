import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { NotificationService } from '../../api/notification.service.js';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import { SubscriptionConfirmedSubscriber } from './subscription-confirmed.subscriber.js';

describe('SubscriptionConfirmedSubscriber', () => {
  it('sends a subscription confirmed email', async () => {
    const notificationService = mock<NotificationService>();
    const subscriber = new SubscriptionConfirmedSubscriber(notificationService);

    await subscriber.handle({
      type: SubscriptionEventType.Confirmed,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        email: 'test@example.com',
        repo: 'owner/repo',
        unsubscribeToken: 'unsub-token',
      },
    });

    expect(
      notificationService.notifySubscriptionConfirmed,
    ).toHaveBeenCalledWith({
      email: 'test@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    });
  });
});
