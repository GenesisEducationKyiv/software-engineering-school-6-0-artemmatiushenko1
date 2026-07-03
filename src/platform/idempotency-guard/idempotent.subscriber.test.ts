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

  it('runs work on first claim', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release: vi.fn() });
    const subscriber = new TestSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(idempotencyGuard.claim).toHaveBeenCalledWith(`msg-1:${TEST_NAME}`);
    expect(subscriber.onWork).toHaveBeenCalledWith(event);
  });

  it('skips work on duplicate claim', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue(null);
    const subscriber = new TestSubscriber(idempotencyGuard);

    await subscriber.handle(event);

    expect(subscriber.onWork).not.toHaveBeenCalled();
  });

  it('releases claim when work fails', async () => {
    const release = vi.fn();
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release });
    const subscriber = new TestSubscriber(idempotencyGuard);
    subscriber.onWork.mockRejectedValue(new Error('work failed'));

    await expect(subscriber.handle(event)).rejects.toThrow('work failed');

    expect(release).toHaveBeenCalled();
  });
});
