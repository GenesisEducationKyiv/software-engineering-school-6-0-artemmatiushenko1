import { describe, it, expect, vi } from 'vitest';
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
    payload: {
      email: 'test@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  } as const;

  it('saves the recipient and sends a subscription confirmed email', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release: vi.fn() });
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
  });
});
