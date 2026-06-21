import { Redis } from 'ioredis';
import { type Database } from './db/types.js';
import { type AppConfig } from './config.js';
import { OctokitGithubClient } from './infrastructure/github/octokit.client.js';
import { CachedOctokitGithubClient } from './infrastructure/github/cached-octokit.client.js';
import { NodemailerEmailClient } from './infrastructure/email/nodemailer.client.js';
import { DrizzleSubscriptionRepository } from './repositories/subscription.repository.js';
import { DrizzleTransactionManager } from './infrastructure/db/drizzle-transaction-manager.js';
import { NotificationServiceImpl } from './modules/notification/notification.service.js';
import { ScannerService } from './modules/scanner/scanner.service.js';
import { SubscriptionServiceImpl } from './modules/subscription/application/subscription.service.js';
import { PrometheusMetrics } from './infrastructure/metrics/prometheus-metrics.js';
import { FastifyLogger } from './infrastructure/logger/fastify-logger.js';
import type { FastifyBaseLogger } from 'fastify';
import type { GithubClient } from './domain/github.js';
import type { EmailClient } from './domain/email.js';
import type { NotificationService } from './domain/notification.js';
import type { SubscriptionService } from './modules/subscription/api/subscription-service.interface.js';
import type {
  Logger,
  IdGenerator,
  TokenGenerator,
  Clock,
} from './domain/shared/index.js';
import { CryptoIdGenerator } from './infrastructure/id/crypto-id-generator.js';
import { CryptoTokenGenerator } from './infrastructure/token/crypto-token-generator.js';
import { SystemClock } from './infrastructure/clock/system-clock.js';

export interface AppDependencies {
  db: Database;
  redis: Redis;
  metrics: PrometheusMetrics;
  subscriptionService: SubscriptionService;
  scannerService: ScannerService;
  logger: Logger;
}

export class AppContainer {
  private loggerInstance?: Logger;
  private metricsInstance?: PrometheusMetrics;
  private redisInstance?: Redis;
  private githubClientInstance?: GithubClient;
  private emailClientInstance?: EmailClient;
  private subscriptionRepoInstance?: DrizzleSubscriptionRepository;
  private transactionManagerInstance?: DrizzleTransactionManager;
  private notificationServiceInstance?: NotificationService;
  private scannerServiceInstance?: ScannerService;
  private subscriptionServiceInstance?: SubscriptionService;
  private idGeneratorInstance?: IdGenerator;
  private tokenGeneratorInstance?: TokenGenerator;
  private clockInstance?: Clock;

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

  get metrics(): PrometheusMetrics {
    return (this.metricsInstance ??= new PrometheusMetrics());
  }

  set metrics(value: PrometheusMetrics) {
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
      this.metrics,
    ));
  }

  set notificationService(value: NotificationService) {
    this.notificationServiceInstance = value;
  }

  get scannerService(): ScannerService {
    return (this.scannerServiceInstance ??= new ScannerService(
      this.subscriptionService,
      this.githubClient,
      this.notificationService,
      this.logger,
      this.metrics,
    ));
  }

  set scannerService(value: ScannerService) {
    this.scannerServiceInstance = value;
  }

  get subscriptionService(): SubscriptionService {
    return (this.subscriptionServiceInstance ??= new SubscriptionServiceImpl(
      this.subscriptionRepo,
      this.githubClient,
      this.notificationService,
      this.transactionManager,
      this.logger,
      this.idGenerator,
      this.tokenGenerator,
      this.clock,
    ));
  }

  set subscriptionService(value: SubscriptionService) {
    this.subscriptionServiceInstance = value;
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
      subscriptionService: this.subscriptionService,
      scannerService: this.scannerService,
      logger: this.logger,
    };
  }
}
