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
import type { TokenGenerator } from './modules/subscription/application/ports/token-generator.js';
import type { IdGenerator } from './shared-kernel/id-generator.js';
import { InProcessEventBus } from './platform/event-bus/in-process-event-bus.js';
import type { EventBus } from './platform/event-bus/event-bus.interface.js';
import { DrizzleTransactionManager } from './platform/db/drizzle-transaction-manager.js';
import { DrizzleOutboxRepository } from './platform/outbox/drizzle-outbox.repository.js';
import type { Outbox } from './platform/outbox/outbox.js';
import { OutboxRelay } from './platform/outbox/outbox-relay.js';
import { NodeCronScheduler } from './platform/scheduler/node-cron-scheduler.js';
import { registerEventSubscribers } from './platform/event-bus/event-subscriber.js';
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
  outboxRelay: OutboxRelay;
}

export interface AppContainerDeps {
  db: Database;
  logger: Logger;
  redis: Redis;
  metrics?: Metrics;
  clock?: Clock;
  githubClient?: GithubClient;
  emailClient?: EmailClient;
  idGenerator?: IdGenerator;
  tokenGenerator?: TokenGenerator;
  eventBus?: EventBus;
}

export class AppContainer {
  private readonly github: GithubModule;
  private readonly notification: NotificationModule;
  private readonly subscription: SubscriptionModule;
  private readonly scanner: ScannerModule;
  private readonly eventBus: EventBus;
  private readonly outboxRelay: OutboxRelay;
  private readonly metrics: Metrics;

  constructor(
    config: AppConfig,
    private readonly deps: AppContainerDeps,
  ) {
    this.eventBus = deps.eventBus ?? new InProcessEventBus();
    const clock = deps.clock ?? new SystemClock();
    const idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    const tokenGenerator = deps.tokenGenerator ?? new CryptoTokenGenerator();
    this.metrics = deps.metrics ?? new PrometheusMetrics();

    const transactionManager = new DrizzleTransactionManager(deps.db);
    const outboxRepository = new DrizzleOutboxRepository(deps.db, idGenerator);
    const outbox: Outbox = outboxRepository;
    this.outboxRelay = new OutboxRelay(
      outboxRepository,
      this.eventBus,
      transactionManager,
      deps.logger,
      this.metrics,
      new NodeCronScheduler(),
      config.outboxRelayCron,
      config.outboxMaxRetries,
    );

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
      db: deps.db,
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
      logger: deps.logger,
      outbox,
    });

    this.scanner = ScannerModule.create({
      db: deps.db,
      githubClient: this.github.githubClient,
      logger: deps.logger,
      clock,
      metrics: this.metrics,
      outbox,
      cronExpression: config.scanner.cronExpression,
    });
  }

  private wireEventSubscribers(): void {
    for (const module of [this.notification, this.scanner]) {
      registerEventSubscribers(this.eventBus, module.eventSubscribers);
    }
  }

  build(): AppDependencies {
    this.wireEventSubscribers();

    return {
      redis: this.deps.redis,
      metrics: this.metrics,
      logger: this.deps.logger,
      subscription: this.subscription,
      notification: this.notification,
      github: this.github,
      scanner: this.scanner,
      outboxRelay: this.outboxRelay,
    };
  }
}
