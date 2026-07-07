import { type Database } from './platform/db/types.js';
import { type AppConfig } from './config.js';
import { GithubModule } from './modules/github/github.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { SubscriptionModule } from './modules/subscription/subscription.module.js';
import { ScannerModule } from './modules/scanner/scanner.module.js';
import { collectDefaultMetrics, Registry } from 'prom-client';
import type { CacheMetrics } from './modules/github/api/cache-metrics.interface.js';
import { PrometheusCacheMetrics } from './modules/github/infrastructure/prometheus-cache-metrics.js';
import type { NotificationMetrics } from './modules/notification/application/ports/notification-metrics.js';
import { PrometheusNotificationMetrics } from './modules/notification/infrastructure/prometheus-notification-metrics.js';
import type { ScannerMetrics } from './modules/scanner/application/ports/scanner-metrics.interface.js';
import { PrometheusScannerMetrics } from './modules/scanner/infrastructure/prometheus-scanner-metrics.js';
import type { HttpMetrics } from './platform/metrics/http-metrics.interface.js';
import type { MetricsExporter } from './platform/metrics/metrics-exporter.interface.js';
import type { OutboxMetrics } from './platform/metrics/outbox-metrics.interface.js';
import { PrometheusExporter } from './platform/metrics/prometheus-exporter.js';
import { PrometheusHttpMetrics } from './platform/metrics/prometheus-http-metrics.js';
import { PrometheusOutboxMetrics } from './platform/metrics/prometheus-outbox-metrics.js';
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
import { registerEventSubscribers } from './platform/event-bus/event-subscriber.js';
import { SystemClock } from './modules/subscription/infrastructure/system-clock.js';
import { CryptoIdGenerator } from './modules/subscription/infrastructure/crypto-id-generator.js';
import { CryptoTokenGenerator } from './modules/subscription/infrastructure/crypto-token-generator.js';
import type { Clock } from './shared-kernel/clock.js';

type AppMetrics = {
  notification: NotificationMetrics;
  scanner: ScannerMetrics;
  cache: CacheMetrics;
  http: HttpMetrics;
  outbox: OutboxMetrics;
  exporter: MetricsExporter;
};

export interface AppDependencies {
  redis: Redis;
  httpMetrics: HttpMetrics;
  metricsExporter: MetricsExporter;
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
  private eventSubscribersRegistered = false;
  private readonly metrics: AppMetrics;

  constructor(
    config: AppConfig,
    private readonly deps: AppContainerDeps,
  ) {
    this.eventBus = deps.eventBus ?? new InProcessEventBus();
    this.metrics = AppContainer.createMetrics();

    const clock = deps.clock ?? new SystemClock();
    const idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    const tokenGenerator = deps.tokenGenerator ?? new CryptoTokenGenerator();

    const transactionManager = new DrizzleTransactionManager(deps.db);
    const outboxRepository = new DrizzleOutboxRepository(deps.db, idGenerator);
    const outbox: Outbox = outboxRepository;
    this.outboxRelay = new OutboxRelay(
      outboxRepository,
      this.eventBus,
      transactionManager,
      deps.logger,
      this.metrics.outbox,
      config.outboxMaxRetries,
    );

    this.github = GithubModule.create({
      githubClient: deps.githubClient
        ? { source: 'client', instance: deps.githubClient }
        : {
            source: 'config',
            config: config.github,
            redis: deps.redis,
            metrics: this.metrics.cache,
          },
    });

    this.notification = NotificationModule.create({
      db: deps.db,
      appUrl: config.appUrl,
      metrics: this.metrics.notification,
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
      metrics: this.metrics.scanner,
      outbox,
      cronExpression: config.scanner.cronExpression,
    });
  }

  private static createMetrics(): AppMetrics {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });

    return {
      notification: new PrometheusNotificationMetrics(registry),
      scanner: new PrometheusScannerMetrics(registry),
      cache: new PrometheusCacheMetrics(registry),
      http: new PrometheusHttpMetrics(registry),
      outbox: new PrometheusOutboxMetrics(registry),
      exporter: new PrometheusExporter(registry),
    };
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
      httpMetrics: this.metrics.http,
      metricsExporter: this.metrics.exporter,
      logger: this.deps.logger,
      subscription: this.subscription,
      notification: this.notification,
      github: this.github,
      scanner: this.scanner,
      outboxRelay: this.outboxRelay,
    };
  }
}
