import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  Delivered,
  IntegrationEvent,
} from '../event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from './idempotency-guard.js';
import { IdempotentSubscriber } from './idempotent.subscriber.js';

const TEST_NAME = 'test:handler';
type TestEvent = Delivered<
  IntegrationEvent<Record<string, never>, 'TestEvent'>
>;

class TestSubscriber extends IdempotentSubscriber<TestEvent> {
  readonly eventType = 'TestEvent';
  protected readonly name = TEST_NAME;
  onWork = vi
    .fn<(event: TestEvent) => Promise<void>>()
    .mockResolvedValue(undefined);

  constructor(idempotencyGuard: IdempotencyGuard) {
    super(idempotencyGuard);
  }

  async handle(event: TestEvent): Promise<void> {
    await this.claimAndRun(event, () => this.onWork(event));
  }
}

describe('IdempotentSubscriber', () => {
  const event: TestEvent = {
    type: 'TestEvent',
    aggregateId: 'sub-1',
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    payload: {},
    id: 'msg-1',
  };

  it('runs work and marks processed on first delivery', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(false);
    const subscriber = new TestSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(idempotencyGuard.isProcessed).toHaveBeenCalledWith(
      `msg-1:${TEST_NAME}`,
    );
    expect(subscriber.onWork).toHaveBeenCalledWith(event);
    expect(idempotencyGuard.markProcessed).toHaveBeenCalledWith(
      `msg-1:${TEST_NAME}`,
    );
  });

  it('skips work when already processed', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(true);
    const subscriber = new TestSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(subscriber.onWork).not.toHaveBeenCalled();
    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });

  it('does not mark processed when work fails', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.isProcessed.mockResolvedValue(false);
    const subscriber = new TestSubscriber(idempotencyGuard);
    subscriber.onWork.mockRejectedValue(new Error('work failed'));

    await expect(subscriber.handle(event)).rejects.toThrow('work failed');

    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });
});
