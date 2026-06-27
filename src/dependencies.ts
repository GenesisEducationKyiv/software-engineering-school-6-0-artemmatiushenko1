import { Redis } from 'ioredis';
import { type Database } from './platform/db/types.js';
import { type AppConfig } from './config.js';
import { OctokitGithubClient } from './modules/github/infrastructure/octokit.client.js';
import { CachedOctokitGithubClient } from './modules/github/infrastructure/cached-octokit.client.js';
import { DrizzleSubscriptionRepository } from './modules/subscription/infrastructure/subscription.repository.js';
import { DrizzleTransactionManager } from './platform/db/drizzle-transaction-manager.js';
import { NotificationServiceImpl } from './modules/notification/application/notification.service.js';
import { ScanUseCase } from './modules/scanner/application/scan.use-case.js';
import { SubscribeUseCase } from './modules/subscription/application/use-cases/subscribe.use-case.js';
import { ConfirmUseCase } from './modules/subscription/application/use-cases/confirm.use-case.js';
import { UnsubscribeUseCase } from './modules/subscription/application/use-cases/unsubscribe.use-case.js';
import { GetSubscriptionsByEmailUseCase } from './modules/subscription/application/use-cases/get-subscriptions-by-email.use-case.js';
import { SubscriptionQueriesImpl } from './modules/subscription/application/subscription-queries.js';
import { PrometheusMetrics } from './platform/metrics/prometheus-metrics.js';
import type { Metrics } from './platform/metrics/metrics.interface.js';
import { FastifyLogger } from './platform/logger/fastify-logger.js';
import type { FastifyBaseLogger } from 'fastify';
import type { GithubClient } from './modules/github/api/github-client.interface.js';
import type { EmailClient } from './modules/notification/application/ports/email-client.js';
import type { NotificationService } from './modules/notification/api/notification.service.js';
import type { SubscriptionQueries } from './modules/subscription/api/subscription-queries.interface.js';
import { CryptoTokenGenerator } from './modules/subscription/infrastructure/crypto-token-generator.js';
import { CryptoIdGenerator } from './modules/subscription/infrastructure/crypto-id-generator.js';
import { SystemClock } from './modules/subscription/infrastructure/system-clock.js';
import type { IdGenerator } from './shared-kernel/id-generator.js';
import type { TokenGenerator } from './modules/subscription/application/ports/token-generator.js';
import type { Clock } from './shared-kernel/clock.js';
import type { Logger } from './shared-kernel/logger.js';
import { NodemailerEmailClient } from './modules/notification/infrastructure/nodemailer-email-client.js';
import { InProcessEventBus } from './platform/event-bus/in-process-event-bus.js';
import type { EventBus } from './platform/event-bus/event-bus.interface.js';

export interface AppDependencies {
  db: Database;
  redis: Redis;
  metrics: Metrics;
  subscribeUseCase: SubscribeUseCase;
  confirmUseCase: ConfirmUseCase;
  unsubscribeUseCase: UnsubscribeUseCase;
  getSubscriptionsByEmailUseCase: GetSubscriptionsByEmailUseCase;
  scanUseCase: ScanUseCase;
  logger: Logger;
}

export class AppContainer {
  private loggerInstance?: Logger;
  private metricsInstance?: Metrics;
  private redisInstance?: Redis;
  private githubClientInstance?: GithubClient;
  private emailClientInstance?: EmailClient;
  private subscriptionRepoInstance?: DrizzleSubscriptionRepository;
  private transactionManagerInstance?: DrizzleTransactionManager;
  private notificationServiceInstance?: NotificationService;
  private scanUseCaseInstance?: ScanUseCase;
  private subscriptionQueriesInstance?: SubscriptionQueries;
  private subscribeUseCaseInstance?: SubscribeUseCase;
  private confirmUseCaseInstance?: ConfirmUseCase;
  private unsubscribeUseCaseInstance?: UnsubscribeUseCase;
  private getSubscriptionsByEmailUseCaseInstance?: GetSubscriptionsByEmailUseCase;
  private idGeneratorInstance?: IdGenerator;
  private tokenGeneratorInstance?: TokenGenerator;
  private clockInstance?: Clock;
  private eventBusInstance?: EventBus;

  constructor(
    private readonly config: AppConfig,
    private readonly fastifyBaseLogger: FastifyBaseLogger,
    public readonly db: Database,
  ) {}

  get logger(): Logger {
    return (this.loggerInstance ??= new FastifyLogger(this.fastifyBaseLogger));
  }

  set logger(value: Logger) {
    this.loggerInstance = value;
  }

  get metrics(): Metrics {
    return (this.metricsInstance ??= new PrometheusMetrics());
  }

  set metrics(value: Metrics) {
    this.metricsInstance = value;
  }

  get redis(): Redis {
    if (!this.redisInstance) {
      this.redisInstance = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: null,
      });
      this.redisInstance.on('error', (err) => {
        this.logger.error('Redis connection error', err);
      });
    }
    return this.redisInstance;
  }

  set redis(value: Redis) {
    this.redisInstance = value;
  }

  get githubClient(): GithubClient {
    return (this.githubClientInstance ??= new CachedOctokitGithubClient(
      new OctokitGithubClient(
        this.config.githubApiBaseUrl,
        this.config.githubToken,
      ),
      this.redis,
      this.config.githubCacheTtl,
      this.metrics,
    ));
  }

  set githubClient(value: GithubClient) {
    this.githubClientInstance = value;
  }

  get emailClient(): EmailClient {
    return (this.emailClientInstance ??= new NodemailerEmailClient(
      this.config.email,
    ));
  }

  set emailClient(value: EmailClient) {
    this.emailClientInstance = value;
  }

  get subscriptionRepo(): DrizzleSubscriptionRepository {
    return (this.subscriptionRepoInstance ??= new DrizzleSubscriptionRepository(
      this.db,
    ));
  }

  set subscriptionRepo(value: DrizzleSubscriptionRepository) {
    this.subscriptionRepoInstance = value;
  }

  get transactionManager(): DrizzleTransactionManager {
    return (this.transactionManagerInstance ??= new DrizzleTransactionManager(
      this.db,
    ));
  }

  set transactionManager(value: DrizzleTransactionManager) {
    this.transactionManagerInstance = value;
  }

  get notificationService(): NotificationService {
    return (this.notificationServiceInstance ??= new NotificationServiceImpl(
      this.emailClient,
      this.config.appUrl,
      this.eventBus,
      this.metrics,
    ));
  }

  set notificationService(value: NotificationService) {
    this.notificationServiceInstance = value;
  }

  get subscriptionQueries(): SubscriptionQueries {
    return (this.subscriptionQueriesInstance ??= new SubscriptionQueriesImpl(
      this.subscriptionRepo,
      this.transactionManager,
    ));
  }

  set subscriptionQueries(value: SubscriptionQueries) {
    this.subscriptionQueriesInstance = value;
  }

  get eventBus(): EventBus {
    return (this.eventBusInstance ??= new InProcessEventBus());
  }

  set eventBus(value: EventBus) {
    this.eventBusInstance = value;
  }

  get subscribeUseCase(): SubscribeUseCase {
    return (this.subscribeUseCaseInstance ??= new SubscribeUseCase(
      this.subscriptionRepo,
      this.githubClient,
      this.transactionManager,
      this.logger,
      this.idGenerator,
      this.tokenGenerator,
      this.clock,
      this.eventBus,
    ));
  }

  set subscribeUseCase(value: SubscribeUseCase) {
    this.subscribeUseCaseInstance = value;
  }

  get confirmUseCase(): ConfirmUseCase {
    return (this.confirmUseCaseInstance ??= new ConfirmUseCase(
      this.subscriptionRepo,
      this.transactionManager,
      this.logger,
      this.tokenGenerator,
      this.clock,
      this.eventBus,
    ));
  }

  set confirmUseCase(value: ConfirmUseCase) {
    this.confirmUseCaseInstance = value;
  }

  get unsubscribeUseCase(): UnsubscribeUseCase {
    return (this.unsubscribeUseCaseInstance ??= new UnsubscribeUseCase(
      this.subscriptionRepo,
      this.transactionManager,
      this.logger,
      this.clock,
    ));
  }

  set unsubscribeUseCase(value: UnsubscribeUseCase) {
    this.unsubscribeUseCaseInstance = value;
  }

  get getSubscriptionsByEmailUseCase(): GetSubscriptionsByEmailUseCase {
    return (this.getSubscriptionsByEmailUseCaseInstance ??=
      new GetSubscriptionsByEmailUseCase(this.subscriptionRepo));
  }

  set getSubscriptionsByEmailUseCase(value: GetSubscriptionsByEmailUseCase) {
    this.getSubscriptionsByEmailUseCaseInstance = value;
  }

  get scanUseCase(): ScanUseCase {
    return (this.scanUseCaseInstance ??= new ScanUseCase(
      this.subscriptionQueries,
      this.githubClient,
      this.notificationService,
      this.logger,
      this.clock,
      this.metrics,
    ));
  }

  set scanUseCase(value: ScanUseCase) {
    this.scanUseCaseInstance = value;
  }

  get idGenerator(): IdGenerator {
    return (this.idGeneratorInstance ??= new CryptoIdGenerator());
  }

  set idGenerator(value: IdGenerator) {
    this.idGeneratorInstance = value;
  }

  get tokenGenerator(): TokenGenerator {
    return (this.tokenGeneratorInstance ??= new CryptoTokenGenerator());
  }

  set tokenGenerator(value: TokenGenerator) {
    this.tokenGeneratorInstance = value;
  }

  get clock(): Clock {
    return (this.clockInstance ??= new SystemClock());
  }

  set clock(value: Clock) {
    this.clockInstance = value;
  }

  build(): AppDependencies {
    return {
      db: this.db,
      redis: this.redis,
      metrics: this.metrics,
      subscribeUseCase: this.subscribeUseCase,
      confirmUseCase: this.confirmUseCase,
      unsubscribeUseCase: this.unsubscribeUseCase,
      getSubscriptionsByEmailUseCase: this.getSubscriptionsByEmailUseCase,
      scanUseCase: this.scanUseCase,
      logger: this.logger,
    };
  }
}
