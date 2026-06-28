import type { GithubClient } from '../github/api/github-client.interface.js';
import type { NotificationService } from '../notification/api/notification.service.js';
import type { SubscriptionQueries } from '../subscription/api/subscription-queries.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { ScanUseCase } from './application/scan.use-case.js';
import type { ScannerMetrics } from './application/ports/scanner-metrics.interface.js';

export interface ScannerModuleDeps {
  subscriptionQueries: SubscriptionQueries;
  githubClient: GithubClient;
  notificationService: NotificationService;
  logger: Logger;
  clock: Clock;
  metrics: ScannerMetrics;
}

export class ScannerModule {
  readonly scanUseCase: ScanUseCase;

  private constructor(private readonly deps: ScannerModuleDeps) {
    this.scanUseCase = new ScanUseCase(
      this.deps.subscriptionQueries,
      this.deps.githubClient,
      this.deps.notificationService,
      this.deps.logger,
      this.deps.clock,
      this.deps.metrics,
    );
  }

  static create(deps: ScannerModuleDeps): ScannerModule {
    return new ScannerModule(deps);
  }
}
