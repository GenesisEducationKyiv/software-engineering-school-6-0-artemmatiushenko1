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
import { InProcessEventBus } from './platform/event-bus/in-process-event-bus.js';
import type { EventBus } from './platform/event-bus/event-bus.interface.js';
import { registerEventSubscribers } from './platform/event-bus/event-subscriber.js';

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
  githubClient: GithubClient;
  emailClient: EmailClient;
  idGenerator: IdGenerator;
  tokenGenerator: TokenGenerator;
  eventBus?: EventBus;
}

export class AppContainer {
  private readonly github: GithubModule;
  private readonly notification: NotificationModule;
  private readonly subscription: SubscriptionModule;
  private readonly scanner: ScannerModule;
  private readonly eventBus: EventBus;
  private eventSubscribersRegistered = false;

  constructor(
    config: AppConfig,
    private readonly deps: AppContainerDeps,
  ) {
    this.eventBus = deps.eventBus ?? new InProcessEventBus();

    this.github = GithubModule.create();

    this.notification = NotificationModule.create({
      db: deps.db,
      emailClient: deps.emailClient,
      appUrl: config.appUrl,
      metrics: deps.metrics,
    });

    this.subscription = SubscriptionModule.create({
      db: deps.db,
      githubClient: deps.githubClient,
      logger: deps.logger,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      tokenGenerator: deps.tokenGenerator,
      eventBus: this.eventBus,
    });

    this.scanner = ScannerModule.create({
      db: deps.db,
      githubClient: deps.githubClient,
      logger: deps.logger,
      clock: deps.clock,
      metrics: deps.metrics,
      eventBus: this.eventBus,
      cronExpression: config.scannerCron,
    });
  }

  wireEventSubscribers(): void {
    if (this.eventSubscribersRegistered) {
      return;
    }

    for (const module of [this.notification, this.scanner]) {
      registerEventSubscribers(this.eventBus, module.eventSubscribers);
    }

    this.eventSubscribersRegistered = true;
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
