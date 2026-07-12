import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EmailClient } from '../ports/email-client.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import {
  SubscriptionEventType,
  type SubscriptionConfirmedEvent,
} from '../../../subscription/api/events.js';
import { SubscriptionConfirmedSubscriber } from './subscription-confirmed.subscriber.js';
import { Email, Recipient } from '../../domain/index.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';

describe('SubscriptionConfirmedSubscriber', () => {
  const event: SubscriptionConfirmedEvent = {
    type: SubscriptionEventType.Confirmed,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  };

  const recipientRepository = mock<RecipientRepository>();
  const emailClient = mock<EmailClient>();
  const metrics = mock<NotificationMetrics>();

  let subscriber: SubscriptionConfirmedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriber = new SubscriptionConfirmedSubscriber(
      recipientRepository,
      emailClient,
      'http://localhost:3000',
      metrics,
    );
  });

  it('saves the recipient and sends a subscription confirmed email', async () => {
    await subscriber.handle(event);

    expect(recipientRepository.save).toHaveBeenCalledWith(
      Recipient.rehydrate({
        subscriptionId: 'sub-1',
        email: Email.fromString('test@example.com'),
        unsubscribeToken: 'unsub-token',
      }),
    );
    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        text: expect.stringContaining(
          'http://localhost:3000/unsubscribe/unsub-token',
        ),
        subject: expect.stringContaining('owner/repo'),
      }),
    );
  });
});
