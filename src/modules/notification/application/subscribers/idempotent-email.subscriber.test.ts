import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { DeliveredEvent } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { deliveryKey } from '../../../../platform/idempotency-guard/delivery-key.js';
import { IdempotentEmailSubscriber } from './idempotent-email.subscriber.js';

const TEST_CONSUMER = 'notification:test-event';

class TestEmailSubscriber extends IdempotentEmailSubscriber<
  DeliveredEvent<Record<string, never>, 'TestEvent'>
> {
  readonly eventType = 'TestEvent';
  onDeliver = vi.fn().mockResolvedValue(undefined);

  constructor(idempotencyGuard: IdempotencyGuard) {
    super(idempotencyGuard, TEST_CONSUMER);
  }

  protected override async deliver(
    event: DeliveredEvent<Record<string, never>, 'TestEvent'>,
  ): Promise<void> {
    await this.onDeliver(event);
  }
}

describe('IdempotentEmailSubscriber', () => {
  const event = {
    type: 'TestEvent' as const,
    aggregateId: 'sub-1',
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    payload: {},
    messageId: 'msg-1',
  };

  it('delivers on first claim', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release: vi.fn() });
    const subscriber = new TestEmailSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(idempotencyGuard.claim).toHaveBeenCalledWith(
      deliveryKey('msg-1', TEST_CONSUMER),
    );
    expect(subscriber.onDeliver).toHaveBeenCalledWith(event);
  });

  it('skips delivery on duplicate claim', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue(null);
    const subscriber = new TestEmailSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(subscriber.onDeliver).not.toHaveBeenCalled();
  });

  it('releases claim when delivery fails', async () => {
    const release = vi.fn();
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release });
    const subscriber = new TestEmailSubscriber(idempotencyGuard);
    subscriber.onDeliver.mockRejectedValue(new Error('send failed'));

    await expect(subscriber.handle(event)).rejects.toThrow('send failed');

    expect(release).toHaveBeenCalled();
  });
});
