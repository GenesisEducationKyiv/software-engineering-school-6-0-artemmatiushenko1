import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Outbox } from '../../platform/outbox/outbox.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../subscription/api/events.js';
import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { ScannerMetrics } from './application/ports/scanner-metrics.interface.js';
import { ScannerModule } from './scanner.module.js';

describe('ScannerModule', () => {
  it('registers scanner event handlers on the event bus', () => {
    const eventBus = mock<EventBus>();
    const module = ScannerModule.create({
      db: mock<Database>(),
      githubClient: mock<GithubClient>(),
      logger: mock<Logger>(),
      clock: mock<Clock>(),
      metrics: mock<ScannerMetrics>(),
      outbox: mock<Outbox>(),
    });

    module.registerEventSubscribers(eventBus);

    expect(eventBus.subscribe).toHaveBeenCalledTimes(2);
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Confirmed,
      expect.any(Function),
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      SubscriptionEventType.Deactivated,
      expect.any(Function),
    );
  });
});
