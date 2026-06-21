import { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import YAML from 'yaml';
import type { OpenAPIV2 } from 'openapi-types';
import { isDomainError } from './domain/errors.js';
import { resolveDomainErrorHttpResponse } from './infrastructure/http/domain-error-http-status.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { type AppConfig } from './config.js';
import { registerSubscribeRoute } from './modules/subscription/infrastructure/http/subscribe.controller.js';
import { registerListSubscriptionsRoute } from './modules/subscription/infrastructure/http/list-subscriptions.controller.js';
import { registerConfirmRoute } from './modules/subscription/infrastructure/http/confirm.controller.js';
import { registerUnsubscribeRoute } from './modules/subscription/infrastructure/http/unsubscribe.controller.js';
import { metricsRoutes } from './routes/metrics.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import cron, { type ScheduledTask } from 'node-cron';
import { CommonErrorResponseDtoSchema } from './dtos/response.dto.js';
import { type AppDependencies } from './dependencies.js';
import { msToSeconds } from './utils/time.utils.js';
import { REQUEST_ID_HEADER } from './infrastructure/fastify/constants.js';
import { runWithRequestLogger } from './infrastructure/logger/request-log-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class App {
  public readonly fastify: FastifyInstance;
  private readonly deps: AppDependencies;
  private readonly config: AppConfig;
  private scanTask?: ScheduledTask;

  private constructor(
    config: AppConfig,
    deps: AppDependencies,
    fastify: FastifyInstance,
  ) {
    this.deps = deps;
    this.fastify = fastify;
    this.config = config;
  }

  public static async create(
    config: AppConfig,
    deps: AppDependencies,
    fastify: FastifyInstance,
  ): Promise<App> {
    const app = new App(config, deps, fastify);
    await app.initialize();
    return app;
  }

  private async initialize(): Promise<void> {
    this.setupHttpLogging();
    await this.serveStaticFiles();
    await this.setupSwagger();
    this.setupErrorHandler();
    await this.setupRoutes();
  }

  private setupHttpLogging(): void {
    this.fastify.addHook('onRequest', (request, reply, done) => {
      reply.header(REQUEST_ID_HEADER, request.id);

      const requestLogger = request.log.child({
        method: request.method,
        route: request.url,
        ip: request.ip,
      });

      request.log = requestLogger;

      runWithRequestLogger(requestLogger, () => {
        done();
      });
    });

    this.fastify.addHook('onResponse', async (request, reply) => {
      const route = request.routeOptions?.url ?? 'unknown';
      const durationSeconds = msToSeconds(reply.elapsedTime);

      this.deps.metrics.recordHttpRequest(
        request.method,
        route,
        reply.statusCode,
        durationSeconds,
      );

      this.deps.logger.info('Request completed', {
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      });
    });
  }

  private setupErrorHandler() {
    this.fastify.setErrorHandler((error, _, reply) => {
      this.deps.logger.error('Request error', error as Error);

      if (isDomainError(error)) {
        const { status, body } = resolveDomainErrorHttpResponse(error);

        return reply
          .status(status)
          .send(CommonErrorResponseDtoSchema.parse(body));
      }

      reply.status(500).send(
        CommonErrorResponseDtoSchema.parse({
          code: 'INTERNAL_SERVER_ERROR',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  private async serveStaticFiles() {
    const clientPath = path.join(__dirname, '../client/dist');

    if (fs.existsSync(clientPath)) {
      await this.fastify.register(fastifyStatic, {
        root: clientPath,
        prefix: '/',
        wildcard: false,
      });

      this.fastify.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith(this.config.apiPrefix)) {
          return reply.status(404).send({ error: 'Not Found' });
        }
        return reply.sendFile('index.html');
      });
    }
  }

  private async setupSwagger() {
    const swaggerPath = path.join(__dirname, '../swagger.yaml');
    const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
    const swaggerConfig = YAML.parse(swaggerFile) as OpenAPIV2.Document;

    const appUrl = new URL(this.config.appUrl);
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

  private async setupRoutes() {
    await this.fastify.register(healthRoutes);
    await this.fastify.register(metricsRoutes, {
      metrics: this.deps.metrics,
    });
    await this.fastify.register(
      (fastify) => {
        const { subscriptionService } = this.deps;

        registerSubscribeRoute(fastify, subscriptionService);
        registerListSubscriptionsRoute(fastify, subscriptionService);
        registerConfirmRoute(fastify, subscriptionService);
        registerUnsubscribeRoute(fastify, subscriptionService);
      },
      { prefix: this.config.apiPrefix },
    );
  }

  startScannerCron() {
    this.scanTask = cron.schedule(this.config.scannerCron, async () => {
      this.deps.logger.info('Starting scheduled scan');
      try {
        await this.deps.scannerService.scan();
        this.deps.logger.info('Scheduled scan completed');
      } catch (error) {
        if (error instanceof Error) {
          this.deps.logger.error('Scheduled scan failed', error);
        } else {
          throw error;
        }
      }
    });
  }

  public async start() {
    try {
      const { port, host } = this.config;

      await this.fastify.listen({ port, host });

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
      this.deps.logger.info('Starting graceful shutdown', { signal });

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
