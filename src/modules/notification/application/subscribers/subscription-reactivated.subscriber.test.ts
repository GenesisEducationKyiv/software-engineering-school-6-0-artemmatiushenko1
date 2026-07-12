import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { EmailClient } from '../ports/email-client.js';
import {
  SubscriptionEventType,
  type SubscriptionReactivatedEvent,
} from '../../../subscription/api/events.js';
import { SubscriptionReactivatedSubscriber } from './subscription-reactivated.subscriber.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

describe('SubscriptionReactivatedSubscriber', () => {
  const event: Delivered<SubscriptionReactivatedEvent> = {
    type: SubscriptionEventType.Reactivated,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      confirmationToken: 'token-123',
    },
  };

  const idempotencyGuard = mock<IdempotencyGuard>();
  const emailClient = mock<EmailClient>();
  const metrics = mock<NotificationMetrics>();

  let subscriber: SubscriptionReactivatedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    idempotencyGuard.isProcessed.mockResolvedValue(false);

    subscriber = new SubscriptionReactivatedSubscriber(
      idempotencyGuard,
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
