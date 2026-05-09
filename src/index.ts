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

class App {
  private fastify: FastifyInstance;
  private scannerService?: ScannerService;
  private scanTask?: ScheduledTask;
  private metrics: PrometheusMetrics;
  private redis?: Redis;

  constructor() {
    this.fastify = Fastify({
      logger: true,
    });
    this.metrics = new PrometheusMetrics();
    this.setupErrorHandler();
  }

  private async runMigrations() {
    this.fastify.log.info('Running database migrations...');
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../drizzle'),
    });
    this.fastify.log.info('Migrations completed successfully.');
  }

  private setupErrorHandler() {
    this.fastify.setErrorHandler((error, request, reply) => {
      if (error instanceof DomainError) {
        return reply.status(error.status).send({
          error: error.message,
          code: error.code,
        });
      }

      this.fastify.log.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    });
  }

  private async setupSwagger() {
    const swaggerPath = path.join(__dirname, '../swagger.yaml');
    const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
    const swaggerConfig = YAML.parse(swaggerFile);

    const appUrl = new URL(config.appUrl);
    swaggerConfig.host = appUrl.host;
    swaggerConfig.schemes = [appUrl.protocol.replace(':', '')];

    await this.fastify.register(fastifySwagger, {
      mode: 'static',
      specification: {
        document: swaggerConfig,
      },
    });

    await this.fastify.register(fastifySwaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });
  }

  private async setupStaticFiles() {
    const clientPath = path.join(__dirname, '../client/dist');

    if (fs.existsSync(clientPath)) {
      await this.fastify.register(fastifyStatic, {
        root: clientPath,
        prefix: '/',
        wildcard: false,
      });

      this.fastify.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith(config.apiPrefix)) {
          return reply.status(404).send({ error: 'Not Found' });
        }
        return reply.sendFile('index.html');
      });
    }
  }

  private setupMetrics() {
    this.fastify.get('/metrics', async (request, reply) => {
      reply.header('Content-Type', this.metrics.getContentType());
      return this.metrics.getMetrics();
    });
  }

  private async setupServices() {
    const logger = new FastifyLogger(this.fastify.log);
    const subscriptionRepo = new DrizzleSubscriptionRepository();

    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.redis.on('error', (err) => {
      logger.error(err.toString(), 'Redis error');
    });

    const octokitClient = new OctokitGithubClient(config.githubToken);
    const githubClient = new CachedOctokitGithubClient(
      octokitClient,
      this.redis,
      config.githubCacheTtl,
      this.metrics,
    );

    const emailService = new NodemailerEmailService(config.email);
    const tokenManager = new DbSubscriptionTokenManager(subscriptionRepo);
    const transactionManager = new DrizzleTransactionManager();

    const notificationService = new NotificationService(
      emailService,
      tokenManager,
      logger,
      config.appUrl,
      this.metrics,
    );
    this.scannerService = new ScannerService(
      subscriptionRepo,
      githubClient,
      notificationService,
      logger,
      this.metrics,
    );
    const subscriptionService = new SubscriptionService(
      subscriptionRepo,
      githubClient,
      emailService,
      tokenManager,
      transactionManager,
      logger,
      config.appUrl,
      this.scannerService,
      this.metrics,
    );

    await this.fastify.register(subscriptionRoutes, {
      subscriptionService,
      prefix: config.apiPrefix,
    });
  }

  private setupScanner() {
    if (!this.scannerService) return;

    this.scanTask = cron.schedule(config.scannerCron, async () => {
      this.fastify.log.info('Starting scheduled scan...');
      try {
        await this.scannerService?.scan();
        this.fastify.log.info('Scheduled scan completed.');
      } catch (error) {
        this.fastify.log.error(error, 'Scheduled scan failed.');
      }
    });
  }

  public async start() {
    try {
      await this.runMigrations();
      await this.setupSwagger();
      await this.setupStaticFiles();
      this.setupMetrics();
      await this.setupServices();
      this.setupScanner();

      await this.fastify.listen({ port: config.port, host: config.host });

      this.fastify.log.info('Performing initial scan...');
      await this.scannerService
        ?.scan()
        .catch((err) => this.fastify.log.error(err, 'Initial scan failed.'));

      this.setupGracefulShutdown();
    } catch (err) {
      this.fastify.log.error(err);
      process.exit(1);
    }
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      this.fastify.log.info(
        `Received ${signal}. Starting graceful shutdown...`,
      );

      this.scanTask?.stop();
      this.fastify.log.info('Scanner tasks stopped.');

      try {
        await this.redis?.quit();
        this.fastify.log.info('Redis connection closed.');
        await this.fastify.close();
        this.fastify.log.info('Fastify server closed.');
        process.exit(0);
      } catch (err) {
        this.fastify.log.error(err, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

const app = new App();
app.start();
