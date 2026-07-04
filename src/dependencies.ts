import { type Database } from './platform/db/types.js';
import { type AppConfig } from './config.js';
import { GithubModule } from './modules/github/github.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { SubscriptionModule } from './modules/subscription/subscription.module.js';
import { ScannerModule } from './modules/scanner/scanner.module.js';
import type { Metrics } from './platform/metrics/metrics.interface.js';
import type { GithubClient } from './modules/github/api/github-client.interface.js';
import type { EmailClient } from './modules/notification/application/ports/email-client.js';
import type { Clock } from './shared-kernel/clock.js';
import type { Logger } from './shared-kernel/logger.js';
import type { Redis } from 'ioredis';
import type { TokenGenerator } from './modules/subscription/application/ports/token-generator.js';
import type { IdGenerator } from './shared-kernel/id-generator.js';

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
  metrics: Metrics;
  clock: Clock;
  githubClient?: GithubClient;
  emailClient?: EmailClient;
  idGenerator: IdGenerator;
  tokenGenerator: TokenGenerator;
}

export class AppContainer {
  private readonly github: GithubModule;
  private readonly notification: NotificationModule;
  private readonly subscription: SubscriptionModule;
  private readonly scanner: ScannerModule;

  constructor(
    config: AppConfig,
    private readonly deps: AppContainerDeps,
  ) {
    this.github = GithubModule.create(
      deps.githubClient
        ? { kind: 'client', githubClient: deps.githubClient }
        : {
            kind: 'config',
            redis: deps.redis,
            metrics: deps.metrics,
            githubToken: config.githubToken,
            githubApiBaseUrl: config.githubApiBaseUrl,
            githubCacheTtl: config.githubCacheTtl,
          },
    );

    this.notification = NotificationModule.create(
      deps.emailClient
        ? {
            kind: 'client',
            emailClient: deps.emailClient,
            appUrl: config.appUrl,
            metrics: deps.metrics,
          }
        : {
            kind: 'config',
            config: config.email,
            appUrl: config.appUrl,
            metrics: deps.metrics,
          },
    );

    this.subscription = SubscriptionModule.create({
      db: deps.db,
      githubClient: this.github.githubClient,
      notificationService: this.notification.notificationService,
      logger: deps.logger,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      tokenGenerator: deps.tokenGenerator,
    });

    this.scanner = ScannerModule.create({
      subscriptionQueries: this.subscription.subscriptionQueries,
      githubClient: this.github.githubClient,
      notificationService: this.notification.notificationService,
      logger: deps.logger,
      clock: deps.clock,
      metrics: deps.metrics,
      cronExpression: config.scannerCron,
    });
  }

  build(): AppDependencies {
    return {
      redis: this.deps.redis,
      metrics: this.deps.metrics,
      logger: this.deps.logger,
      subscription: this.subscription,
      notification: this.notification,
      github: this.github,
      scanner: this.scanner,
    };
  }
}
