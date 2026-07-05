import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EmailClient } from '../ports/email-client.js';
import {
  SubscriptionEventType,
  type SubscriptionRequestedEvent,
} from '../../../subscription/api/events.js';
import { SubscriptionRequestedSubscriber } from './subscription-requested.subscriber.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

describe('SubscriptionRequestedSubscriber', () => {
  const event: SubscriptionRequestedEvent = {
    type: SubscriptionEventType.Requested,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      confirmationToken: 'token-123',
    },
  };

  const emailClient = mock<EmailClient>();
  const metrics = mock<NotificationMetrics>();

  let subscriber: SubscriptionRequestedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriber = new SubscriptionRequestedSubscriber(
      emailClient,
      'http://localhost:3000',
      metrics,
    );
  });

  it('sends a subscription confirmation email', async () => {
    await subscriber.handle(event);

    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Confirm subscription: owner/repo',
        text: expect.stringContaining(
          'http://localhost:3000/confirm/token-123',
        ),
      }),
    );
  });
});
