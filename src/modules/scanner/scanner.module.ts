import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { ScanUseCase } from './application/scan.use-case.js';
import type { ScannerMetrics } from './application/ports/scanner-metrics.interface.js';
import { DrizzleMonitoredRepoRepository } from './infrastructure/monitored-repo.repository.js';
import { DrizzleTransactionManager } from '../../platform/db/drizzle-transaction-manager.js';
import type { Outbox } from '../../platform/outbox/outbox.js';
import { DrizzleIdempotencyGuard } from '../../platform/idempotency-guard/drizzle-idempotency-guard.js';
import type {
  Delivered,
  IntegrationEvent,
} from '../../platform/event-bus/domain-event-envelope.js';
import type { EventSubscriber } from '../../platform/event-bus/event-subscriber.js';
import { SubscriptionConfirmedSubscriber } from './application/subscribers/subscription-confirmed.subscriber.js';
import { SubscriptionDeactivatedSubscriber } from './application/subscribers/subscription-deactivated.subscriber.js';
import { ScanCron } from './infrastructure/scan.cron.js';

export interface ScannerModuleDeps {
  db: Database;
  githubClient: GithubClient;
  logger: Logger;
  clock: Clock;
  metrics: ScannerMetrics;
  outbox: Outbox;
  cronExpression: string;
}

export class ScannerModule {
  readonly scanUseCase: ScanUseCase;
  readonly eventSubscribers: EventSubscriber<Delivered<IntegrationEvent>>[];

  private readonly monitoredRepoRepository: DrizzleMonitoredRepoRepository;
  private readonly transactionManager: DrizzleTransactionManager;
  private scanCron?: ScanCron;

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
      deps.outbox,
    );

    const idempotencyGuard = new DrizzleIdempotencyGuard(deps.db);

    this.eventSubscribers = [
      new SubscriptionConfirmedSubscriber(
        idempotencyGuard,
        this.monitoredRepoRepository,
        this.transactionManager,
        deps.githubClient,
      ),
      new SubscriptionDeactivatedSubscriber(
        this.monitoredRepoRepository,
        this.transactionManager,
      ),
    ];
  }

  static create(deps: ScannerModuleDeps): ScannerModule {
    return new ScannerModule(deps);
  }

  startCron(): void {
    if (!this.deps.cronExpression) {
      return;
    }

    this.scanCron = new ScanCron(
      this.deps.cronExpression,
      this.scanUseCase,
      this.deps.logger,
    );
    this.scanCron.start();
  }

  async stopCron(): Promise<void> {
    await this.scanCron?.stop();
  }
}
