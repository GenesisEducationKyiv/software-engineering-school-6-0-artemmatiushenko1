import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { ScanUseCase } from './application/scan.use-case.js';
import type { ScannerMetrics } from './application/ports/scanner-metrics.interface.js';
import { DrizzleMonitoredRepoRepository } from './infrastructure/monitored-repo.repository.js';
import { DrizzleTransactionManager } from '../../platform/db/drizzle-transaction-manager.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';
import { registerEventSubscribers } from '../../platform/event-bus/event-subscriber.js';
import { SubscriptionConfirmedSubscriber } from './application/subscribers/subscription-confirmed.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './application/subscribers/subscription-deactivated.subscriber.js';

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

  private readonly monitoredRepoRepository: DrizzleMonitoredRepoRepository;
  private readonly transactionManager: DrizzleTransactionManager;

  private constructor(private readonly deps: ScannerModuleDeps) {
    this.monitoredRepoRepository = new DrizzleMonitoredRepoRepository(deps.db);
    this.transactionManager = new DrizzleTransactionManager(deps.db);

    this.scanUseCase = new ScanUseCase(
      this.monitoredRepoRepository,
      this.transactionManager,
      deps.githubClient,
      deps.logger,
      deps.clock,
      deps.metrics,
      deps.eventBus,
    );
  }

  registerEventSubscribers(eventBus: EventBus): void {
    registerEventSubscribers(eventBus, [
      new SubscriptionConfirmedSubscriber(
        this.monitoredRepoRepository,
        this.transactionManager,
        this.deps.githubClient,
      ),
      new SubscriptionDeactivatedSubscriber(
        this.monitoredRepoRepository,
        this.transactionManager,
      ),
    ]);
  }

  static create(deps: ScannerModuleDeps): ScannerModule {
    return new ScannerModule(deps);
  }
}
