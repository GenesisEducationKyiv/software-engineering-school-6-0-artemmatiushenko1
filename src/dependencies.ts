import { Redis } from 'ioredis';
import { type Database } from './db/types.js';
import { type AppConfig } from './config.js';
import { OctokitGithubClient } from './infrastructure/github/octokit.client.js';
import { CachedOctokitGithubClient } from './infrastructure/github/cached-octokit.client.js';
import { NodemailerEmailService } from './infrastructure/email/nodemailer.service.js';
import { DrizzleSubscriptionRepository } from './repositories/subscription.repository.js';
import { DbSubscriptionTokenManager } from './services/db-subscription-token-manager.js';
import { DrizzleTransactionManager } from './infrastructure/db/drizzle-transaction-manager.js';
import { NotificationService } from './services/notification.service.js';
import { ScannerService } from './services/scanner.service.js';
import { SubscriptionService } from './services/subscription.service.js';
import { PrometheusMetrics } from './infrastructure/metrics/prometheus-metrics.js';
import { FastifyLogger } from './infrastructure/logger/fastify-logger.js';
import type { FastifyBaseLogger } from 'fastify';
import type { GithubClient } from './domain/github.js';
import type { EmailService } from './domain/email.js';
import type { Logger } from './domain/logger.js';

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
  private emailServiceInstance?: EmailService;
  private subscriptionRepoInstance?: DrizzleSubscriptionRepository;
  private tokenManagerInstance?: DbSubscriptionTokenManager;
  private transactionManagerInstance?: DrizzleTransactionManager;
  private notificationServiceInstance?: NotificationService;
  private scannerServiceInstance?: ScannerService;
  private subscriptionServiceInstance?: SubscriptionService;

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
        this.logger.error('Redis error: ', err);
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

  get emailService(): EmailService {
    return (this.emailServiceInstance ??= new NodemailerEmailService(
      this.config.email,
    ));
  }

  set emailService(value: EmailService) {
    this.emailServiceInstance = value;
  }

  get subscriptionRepo(): DrizzleSubscriptionRepository {
    return (this.subscriptionRepoInstance ??= new DrizzleSubscriptionRepository(
      this.db,
    ));
  }

  set subscriptionRepo(value: DrizzleSubscriptionRepository) {
    this.subscriptionRepoInstance = value;
  }

  get tokenManager(): DbSubscriptionTokenManager {
    return (this.tokenManagerInstance ??= new DbSubscriptionTokenManager(
      this.subscriptionRepo,
    ));
  }

  set tokenManager(value: DbSubscriptionTokenManager) {
    this.tokenManagerInstance = value;
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
    return (this.notificationServiceInstance ??= new NotificationService(
      this.emailService,
      this.tokenManager,
      this.logger,
      this.config.appUrl,
      this.metrics,
    ));
  }

  set notificationService(value: NotificationService) {
    this.notificationServiceInstance = value;
  }

  get scannerService(): ScannerService {
    return (this.scannerServiceInstance ??= new ScannerService(
      this.subscriptionRepo,
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
    return (this.subscriptionServiceInstance ??= new SubscriptionService(
      this.subscriptionRepo,
      this.githubClient,
      this.emailService,
      this.tokenManager,
      this.transactionManager,
      this.logger,
      this.config.appUrl,
      this.scannerService,
      this.metrics,
    ));
  }

  set subscriptionService(value: SubscriptionService) {
    this.subscriptionServiceInstance = value;
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
