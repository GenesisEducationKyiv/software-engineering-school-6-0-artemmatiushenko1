import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { NotificationService } from '../../api/notification.service.js';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import { SubscriptionRequestedHandler } from './subscription-requested.handler.js';

describe('SubscriptionRequestedHandler', () => {
  it('sends a subscription confirmation email', async () => {
    const notificationService = mock<NotificationService>();
    const handler = new SubscriptionRequestedHandler(notificationService);

    await handler.handle({
      type: SubscriptionEventType.Requested,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmationToken: 'token-123',
      },
    });

    expect(
      notificationService.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email: 'test@example.com',
      repo: 'owner/repo',
      confirmToken: 'token-123',
    });
  });
});
