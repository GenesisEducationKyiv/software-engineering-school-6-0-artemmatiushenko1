import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EmailClient } from '../ports/email-client.js';
import {
  SubscriptionEventType,
  type SubscriptionConfirmationRenewedEvent,
} from '../../../subscription/api/events.js';
import { SubscriptionConfirmationRenewedSubscriber } from './subscription-confirmation-renewed.subscriber.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

describe('SubscriptionConfirmationRenewedSubscriber', () => {
  const event: SubscriptionConfirmationRenewedEvent = {
    type: SubscriptionEventType.ConfirmationRenewed,
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

  let subscriber: SubscriptionConfirmationRenewedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriber = new SubscriptionConfirmationRenewedSubscriber(
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
      }),
    );
  });
});
