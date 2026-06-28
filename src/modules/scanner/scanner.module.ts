import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { ScanUseCase } from './application/scan.use-case.js';
import type { ScannerMetrics } from './application/ports/scanner-metrics.interface.js';
import { DrizzleMonitoredRepoRepository } from './infrastructure/monitored-repo.repository.js';
import { DrizzleTransactionManager } from '../../platform/db/drizzle-transaction-manager.js';
import { ScannerEventSubscribers } from './application/scanner-event-subscribers.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';

export interface ScannerModuleDeps {
  db: Database;
  githubClient: GithubClient;
  logger: Logger;
  clock: Clock;
  metrics: ScannerMetrics;
  eventBus: EventBus;
}

export class ScannerModule {
  readonly scanUseCase: ScanUseCase;

  private readonly eventSubscribers: ScannerEventSubscribers;

  private constructor(private readonly deps: ScannerModuleDeps) {
    const monitoredRepoRepository = new DrizzleMonitoredRepoRepository(deps.db);
    const transactionManager = new DrizzleTransactionManager(deps.db);

    this.scanUseCase = new ScanUseCase(
      monitoredRepoRepository,
      transactionManager,
      deps.githubClient,
      deps.logger,
      deps.clock,
      deps.metrics,
      deps.eventBus,
    );
    this.eventSubscribers = new ScannerEventSubscribers(
      monitoredRepoRepository,
      transactionManager,
    );
  }

  registerEventSubscribers(eventBus: EventBus): void {
    this.eventSubscribers.register(eventBus);
  }

  static create(deps: ScannerModuleDeps): ScannerModule {
    return new ScannerModule(deps);
  }
}
