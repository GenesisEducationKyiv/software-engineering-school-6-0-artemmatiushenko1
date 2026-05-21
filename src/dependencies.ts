import { Redis } from 'ioredis';
import { db, type Database } from './db/index.js';
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

export interface DependencyOverrides {
  db?: Database;
  redis?: Redis;
  githubClient?: GithubClient;
  emailService?: EmailService;
  logger?: Logger;
}

export function createDependencies(
  config: AppConfig,
  fastifyBaseLogger: FastifyBaseLogger,
  overrides: DependencyOverrides = {},
): AppDependencies {
  const logger = new FastifyLogger(fastifyBaseLogger);
  const metrics = new PrometheusMetrics();
  const database = overrides.db ?? db;

  const subscriptionRepo = new DrizzleSubscriptionRepository(database);

  const redis =
    overrides.redis ??
    new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });

  redis.on('error', (err) => {
    logger.error('Redis error: ', err);
  });

  const githubClient =
    overrides.githubClient ??
    new CachedOctokitGithubClient(
      new OctokitGithubClient(config.githubApiBaseUrl, config.githubToken),
      redis,
      config.githubCacheTtl,
      metrics,
    );

  const emailService =
    overrides.emailService ?? new NodemailerEmailService(config.email);

  const tokenManager = new DbSubscriptionTokenManager(subscriptionRepo);
  const transactionManager = new DrizzleTransactionManager(database);

  const notificationService = new NotificationService(
    emailService,
    tokenManager,
    logger,
    config.appUrl,
    metrics,
  );

  const scannerService = new ScannerService(
    subscriptionRepo,
    githubClient,
    notificationService,
    logger,
    metrics,
  );

  const subscriptionService = new SubscriptionService(
    subscriptionRepo,
    githubClient,
    emailService,
    tokenManager,
    transactionManager,
    logger,
    config.appUrl,
    scannerService,
    metrics,
  );

  return {
    db: database,
    redis,
    metrics,
    subscriptionService,
    scannerService,
    logger,
  };
}
