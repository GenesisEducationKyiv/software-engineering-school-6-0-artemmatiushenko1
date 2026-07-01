import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { EmailClient } from '../ports/email-client.js';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import { SubscriptionReactivatedSubscriber } from './subscription-reactivated.subscriber.js';

describe('SubscriptionReactivatedSubscriber', () => {
  it('sends a subscription confirmation email', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release: vi.fn() });
    const emailClient = mock<EmailClient>();
    const subscriber = new SubscriptionReactivatedSubscriber(
      idempotencyGuard,
      emailClient,
      'http://localhost:3000',
    );

    await subscriber.handle({
      type: SubscriptionEventType.Reactivated,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmationToken: 'token-123',
      },
    });

    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Confirm subscription: owner/repo',
      }),
    );
  });
});
