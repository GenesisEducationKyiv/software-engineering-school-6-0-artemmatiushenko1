import { describe, it, expect, vi } from 'vitest';
import { InProcessEventBus } from './in-process-event-bus.js';
import type { DomainEventEnvelope } from './domain-event-envelope.js';

const testEvent: DomainEventEnvelope<{ value: number }> = {
  type: 'TestEvent',
  aggregateId: 'agg-1',
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  payload: { value: 1 },
};

describe('InProcessEventBus', () => {
  it('calls every subscriber registered for the same event type', async () => {
    const bus = new InProcessEventBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.subscribe('TestEvent', first);
    bus.subscribe('TestEvent', second);

    await bus.publish([testEvent]);

    expect(first).toHaveBeenCalledWith(testEvent);
    expect(second).toHaveBeenCalledWith(testEvent);
  });

  it('runs handlers in registration order', async () => {
    const bus = new InProcessEventBus();
    const order: number[] = [];

    bus.subscribe('TestEvent', () => {
      order.push(1);
    });
    bus.subscribe('TestEvent', () => {
      order.push(2);
    });

    await bus.publish([testEvent]);

    expect(order).toEqual([1, 2]);
  });
});
