import { describe, it, expect, vi } from 'vitest';
import { InProcessEventBus } from './in-process-event-bus.js';
import type { Delivered, IntegrationEvent } from './domain-event-envelope.js';

const testEvent: Delivered<IntegrationEvent<{ value: number }, 'TestEvent'>> = {
  type: 'TestEvent',
  aggregateId: 'agg-1',
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: { value: 1 },
  id: 'msg-1',
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

  it('continues calling other handlers when one handler throws', async () => {
    const bus = new InProcessEventBus();
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const succeeding = vi.fn();

    bus.subscribe('TestEvent', failing);
    bus.subscribe('TestEvent', succeeding);

    await expect(bus.publish([testEvent])).rejects.toThrow(
      'One or more event handlers failed',
    );

    expect(failing).toHaveBeenCalledWith(testEvent);
    expect(succeeding).toHaveBeenCalledWith(testEvent);
  });

  it('dispose clears subscribers so later publishes are no-ops', async () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();

    bus.subscribe('TestEvent', handler);
    bus.dispose();

    await bus.publish([testEvent]);

    expect(handler).not.toHaveBeenCalled();
  });
});
