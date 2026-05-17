import { type FastifyInstance } from 'fastify';
import type { OpenAPIV2 } from 'openapi-types';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import { DomainError } from './domain/errors.js';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { metricsRoutes } from './routes/metrics.routes.js';
import cron, { type ScheduledTask } from 'node-cron';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { CommonErrorResponseDtoSchema } from './dtos/response.dto.js';
import { type AppDependencies } from './dependencies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class App {
  public readonly fastify: FastifyInstance;
  private readonly deps: AppDependencies;
  private scanTask?: ScheduledTask;

  constructor(deps: AppDependencies, fastify: FastifyInstance) {
    this.deps = deps;
    this.fastify = fastify;
  }

  public async setup(): Promise<FastifyInstance> {
    await this.runMigrations();
    await this.setupSwagger();
    await this.setupStaticFiles();
    this.setupErrorHandler();
    await this.setupRoutes();
    this.setupScanner();
    return this.fastify;
  }

  private async runMigrations() {
    this.deps.logger.info('Running database migrations...');
    await migrate(this.deps.db, {
      migrationsFolder: path.join(__dirname, '../drizzle'),
    });
    this.deps.logger.info('Migrations completed successfully.');
  }

  private setupErrorHandler() {
    this.fastify.setErrorHandler((error, _, reply) => {
      if (error instanceof DomainError) {
        return reply.status(error.status).send(
          CommonErrorResponseDtoSchema.parse({
            error: error.message,
            code: error.code,
          }),
        );
      }

      this.deps.logger.error('Request error:', error as Error);

      reply.status(500).send(
        CommonErrorResponseDtoSchema.parse({
          code: 'INTERNAL_SERVER_ERROR',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  private async setupSwagger() {
    const swaggerPath = path.join(__dirname, '../swagger.yaml');
    const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
    const swaggerConfig = YAML.parse(swaggerFile) as OpenAPIV2.Document;

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

  private async setupRoutes() {
    await this.fastify.register(metricsRoutes, {
      metrics: this.deps.metrics,
    });
    await this.fastify.register(subscriptionRoutes, {
      subscriptionService: this.deps.subscriptionService,
      prefix: config.apiPrefix,
    });
  }

  private setupScanner() {
    if (config.mode === 'test') return;

    this.scanTask = cron.schedule(config.scannerCron, async () => {
      this.deps.logger.info('Starting scheduled scan...');
      try {
        await this.deps.scannerService.scan();
        this.deps.logger.info('Scheduled scan completed.');
      } catch (error) {
        if (error instanceof Error) {
          this.deps.logger.error('Scheduled scan failed.', error);
        } else {
          throw error;
        }
      }
    });
  }

  public async start() {
    try {
      await this.setup();

      await this.fastify.listen({ port: config.port, host: config.host });

      this.deps.logger.info('Performing initial scan...');
      await this.deps.scannerService.scan().catch((err) => {
        if (err instanceof Error) {
          this.deps.logger.error(err.message, err);
        } else {
          throw err;
        }
      });

      this.setupGracefulShutdown();
    } catch (err) {
      if (err instanceof Error) {
        this.deps.logger.error(err.message, err);
      } else {
        throw err;
      }
      process.exit(1);
    }
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      this.deps.logger.info(
        `Received ${signal}. Starting graceful shutdown...`,
      );

      try {
        await this.scanTask?.stop();
        this.deps.logger.info('Scanner tasks stopped.');

        await this.deps.redis.quit();
        this.deps.logger.info('Redis connection closed.');

        await this.fastify.close();
        this.deps.logger.info('Fastify server closed.');
        process.exit(0);
      } catch (err) {
        if (err instanceof Error) {
          this.deps.logger.error(err.message, err);
        } else {
          throw err;
        }
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
