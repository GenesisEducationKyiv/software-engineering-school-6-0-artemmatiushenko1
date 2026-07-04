import { type Database } from './platform/db/types.js';
import { type AppConfig } from './config.js';
import { GithubModule } from './modules/github/github.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { SubscriptionModule } from './modules/subscription/subscription.module.js';
import { ScannerModule } from './modules/scanner/scanner.module.js';
import type { Metrics } from './platform/metrics/metrics.interface.js';
import type { GithubClient } from './modules/github/api/github-client.interface.js';
import type { EmailClient } from './modules/notification/application/ports/email-client.js';
import type { Logger } from './shared-kernel/logger.js';
import type { Redis } from 'ioredis';
import { SystemClock } from './modules/subscription/infrastructure/system-clock.js';
import { CryptoIdGenerator } from './modules/subscription/infrastructure/crypto-id-generator.js';
import { CryptoTokenGenerator } from './modules/subscription/infrastructure/crypto-token-generator.js';
import type { Clock } from './shared-kernel/clock.js';
import { PrometheusMetrics } from './platform/metrics/prometheus-metrics.js';

export interface AppDependencies {
  redis: Redis;
  metrics: Metrics;
  logger: Logger;
  subscription: SubscriptionModule;
  notification: NotificationModule;
  github: GithubModule;
  scanner: ScannerModule;
}

export interface AppContainerDeps {
  db: Database;
  logger: Logger;
  redis: Redis;
  metrics?: Metrics;
  githubClient?: GithubClient;
  emailClient?: EmailClient;
  clock?: Clock;
}

export class AppContainer {
  private readonly github: GithubModule;
  private readonly notification: NotificationModule;
  private readonly subscription: SubscriptionModule;
  private readonly scanner: ScannerModule;
  private readonly metrics: Metrics;

  constructor(
    config: AppConfig,
    private readonly deps: AppContainerDeps,
  ) {
    const clock = deps.clock ?? new SystemClock();
    const idGenerator = new CryptoIdGenerator();
    const tokenGenerator = new CryptoTokenGenerator();

    this.metrics = deps.metrics ?? new PrometheusMetrics();

    this.github = GithubModule.create({
      githubClient: deps.githubClient
        ? { source: 'client', instance: deps.githubClient }
        : {
            source: 'config',
            config: config.github,
            redis: deps.redis,
            metrics: this.metrics,
          },
    });

    this.notification = NotificationModule.create({
      appUrl: config.appUrl,
      metrics: this.metrics,
      emailClient: deps.emailClient
        ? { source: 'client', instance: deps.emailClient }
        : { source: 'config', config: config.email },
    });

    this.subscription = SubscriptionModule.create({
      clock,
      idGenerator,
      tokenGenerator,
      db: deps.db,
      githubClient: this.github.githubClient,
      notificationService: this.notification.notificationService,
      logger: deps.logger,
    });

    this.scanner = ScannerModule.create({
      clock,
      subscriptionQueries: this.subscription.subscriptionQueries,
      githubClient: this.github.githubClient,
      notificationService: this.notification.notificationService,
      logger: deps.logger,
      metrics: this.metrics,
      cronExpression: config.scanner.cronExpression,
    });
  }

  build(): AppDependencies {
    return {
      redis: this.deps.redis,
      metrics: this.metrics,
      logger: this.deps.logger,
      subscription: this.subscription,
      notification: this.notification,
      github: this.github,
      scanner: this.scanner,
    };
  }
}
