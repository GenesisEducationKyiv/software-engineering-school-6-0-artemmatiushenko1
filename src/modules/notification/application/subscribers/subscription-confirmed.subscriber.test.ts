import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { EmailClient } from '../ports/email-client.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import { SubscriptionConfirmedSubscriber } from './subscription-confirmed.subscriber.js';

describe('SubscriptionConfirmedSubscriber', () => {
  const event = {
    type: SubscriptionEventType.Confirmed,
    aggregateId: 'sub-1',
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    id: 'msg-1',
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  } as const;

  it('saves the recipient and sends a subscription confirmed email', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(false);
    const recipientRepository = mock<RecipientRepository>();
    const emailClient = mock<EmailClient>();
    const subscriber = new SubscriptionConfirmedSubscriber(
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
    );

    await subscriber.handle(event);

    expect(recipientRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        email: expect.objectContaining({ value: 'test@example.com' }),
        unsubscribeToken: 'unsub-token',
      }),
    );
    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        text: expect.stringContaining(
          'http://localhost:3000/unsubscribe/unsub-token',
        ),
      }),
    );
    expect(idempotencyGuard.markProcessed).toHaveBeenCalledWith(
      'msg-1:notification:subscription-confirmed',
    );
  });

  it('does not save recipient or send email on duplicate delivery', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(true);
    const recipientRepository = mock<RecipientRepository>();
    const emailClient = mock<EmailClient>();
    const subscriber = new SubscriptionConfirmedSubscriber(
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
    );

    await subscriber.handle(event);

    expect(recipientRepository.save).not.toHaveBeenCalled();
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });

  it('does not mark processed when email delivery fails', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(false);
    const recipientRepository = mock<RecipientRepository>();
    const emailClient = mock<EmailClient>();
    emailClient.sendEmail.mockRejectedValue(new Error('smtp failed'));
    const subscriber = new SubscriptionConfirmedSubscriber(
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
    );

    await expect(subscriber.handle(event)).rejects.toThrow('smtp failed');

    expect(recipientRepository.save).toHaveBeenCalled();
    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });
});
