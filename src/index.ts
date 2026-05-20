import Fastify, { type FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import { DrizzleSubscriptionRepository } from './repositories/subscription.repository.js';
import { OctokitGithubClient } from './infrastructure/github/octokit.client.js';
import { CachedOctokitGithubClient } from './infrastructure/github/cached-octokit.client.js';
import { NodemailerEmailService } from './infrastructure/email/nodemailer.service.js';
import { DbSubscriptionTokenManager } from './services/db-subscription-token-manager.js';
import { SubscriptionService } from './services/subscription.service.js';
import { ScannerService } from './services/scanner.service.js';
import { NotificationService } from './services/notification.service.js';
import { DomainError } from './domain/errors.js';
import type { EmailService } from './domain/email.js';
import type { GithubClient } from './domain/github.js';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import cron, { type ScheduledTask } from 'node-cron';
import { FastifyLogger } from './infrastructure/logger/fastify-logger.js';
import { DrizzleTransactionManager } from './infrastructure/db/drizzle-transaction-manager.js';
import { PrometheusMetrics } from './infrastructure/metrics/prometheus-metrics.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppOverrides {
  emailService?: EmailService;
  githubClient?: GithubClient;
  disableCron?: boolean;
}

export interface AppInstance {
  fastify: FastifyInstance;
  redis: Redis;
  scannerService: ScannerService;
  scanTask?: ScheduledTask;
}

export async function buildApp(overrides: AppOverrides = {}): Promise<AppInstance> {
  const fastify = Fastify({ logger: true });
  const metrics = new PrometheusMetrics();

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.status).send({
        error: error.message,
        code: error.code,
      });
    }

    fastify.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error' });
  });

  const swaggerPath = path.join(__dirname, '../swagger.yaml');
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
  const swaggerConfig = YAML.parse(swaggerFile);

  const appUrl = new URL(config.appUrl);
  swaggerConfig.host = appUrl.host;
  swaggerConfig.schemes = [appUrl.protocol.replace(':', '')];

  await fastify.register(fastifySwagger, {
    mode: 'static',
    specification: { document: swaggerConfig },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'full', deepLinking: false },
  });

  const clientPath = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientPath)) {
    await fastify.register(fastifyStatic, {
      root: clientPath,
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith(config.apiPrefix)) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  }

  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metrics.getContentType());
    return metrics.getMetrics();
  });

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  redis.on('error', (err) => fastify.log.error(err.toString(), 'Redis error'));

  const logger = new FastifyLogger(fastify.log);
  const subscriptionRepo = new DrizzleSubscriptionRepository();

  const octokitClient = new OctokitGithubClient(config.githubToken);
  const cachedGithubClient = new CachedOctokitGithubClient(
    octokitClient,
    redis,
    config.githubCacheTtl,
    metrics,
  );
  const githubClient = overrides.githubClient ?? cachedGithubClient;

  const emailService = overrides.emailService ?? new NodemailerEmailService(config.email);

  const tokenManager = new DbSubscriptionTokenManager(subscriptionRepo);
  const transactionManager = new DrizzleTransactionManager();

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

  await fastify.register(subscriptionRoutes, {
    subscriptionService,
    prefix: config.apiPrefix,
  });

  let scanTask: ScheduledTask | undefined;
  if (!overrides.disableCron) {
    scanTask = cron.schedule(config.scannerCron, async () => {
      fastify.log.info('Starting scheduled scan...');
      try {
        await scannerService.scan();
        fastify.log.info('Scheduled scan completed.');
      } catch (error) {
        fastify.log.error(error, 'Scheduled scan failed.');
      }
    });
  }

  return { fastify, redis, scannerService, scanTask };
}

class App {
  private async runMigrations(fastify: FastifyInstance) {
    fastify.log.info('Running database migrations...');
    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
    fastify.log.info('Migrations completed successfully.');
  }

  public async start() {
    let instance: AppInstance | undefined;
    try {
      instance = await buildApp();
      const { fastify, redis, scannerService, scanTask } = instance;

      await this.runMigrations(fastify);
      await fastify.listen({ port: config.port, host: config.host });

      fastify.log.info('Performing initial scan...');
      await scannerService
        .scan()
        .catch((err) => fastify.log.error(err, 'Initial scan failed.'));

      this.setupGracefulShutdown(fastify, redis, scanTask);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(
    fastify: FastifyInstance,
    redis: Redis,
    scanTask?: ScheduledTask,
  ) {
    const shutdown = async (signal: string) => {
      fastify.log.info(`Received ${signal}. Starting graceful shutdown...`);

      scanTask?.stop();
      fastify.log.info('Scanner tasks stopped.');

      try {
        await redis.quit();
        fastify.log.info('Redis connection closed.');
        await fastify.close();
        fastify.log.info('Fastify server closed.');
        process.exit(0);
      } catch (err) {
        fastify.log.error(err, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file:').href;

if (isEntryPoint) {
  const app = new App();
  app.start();
}
