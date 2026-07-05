import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
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
  const event: Delivered<SubscriptionConfirmedEvent> = {
    type: SubscriptionEventType.Confirmed,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  };

  const idempotencyGuard = mock<IdempotencyGuard>();
  const recipientRepository = mock<RecipientRepository>();
  const emailClient = mock<EmailClient>();
  const metrics = mock<NotificationMetrics>();

  let subscriber: SubscriptionConfirmedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    idempotencyGuard.isProcessed.mockResolvedValue(false);

    subscriber = new SubscriptionConfirmedSubscriber(
      idempotencyGuard,
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
    expect(idempotencyGuard.markProcessed).toHaveBeenCalledWith(
      'msg-1:notification:subscription-confirmed',
    );
  });

  it('does not save recipient or send email on duplicate delivery', async () => {
    idempotencyGuard.isProcessed.mockResolvedValue(true);

    await subscriber.handle(event);

    expect(recipientRepository.save).not.toHaveBeenCalled();
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });

  it('does not mark processed when email delivery fails', async () => {
    emailClient.sendEmail.mockRejectedValue(new Error('smtp failed'));

    await expect(subscriber.handle(event)).rejects.toThrow('smtp failed');

    expect(recipientRepository.save).toHaveBeenCalled();
    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });
});
