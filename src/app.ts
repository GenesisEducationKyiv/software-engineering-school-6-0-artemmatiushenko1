import { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import YAML from 'yaml';
import type { OpenAPIV2 } from 'openapi-types';
import {
  isDomainError,
  resolveDomainErrorHttpResponse,
} from './platform/http/domain-error-registry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { type AppConfig } from './config.js';
import { registerSubscribeRoute } from './modules/subscription/infrastructure/http/subscribe.controller.js';
import { registerListSubscriptionsRoute } from './modules/subscription/infrastructure/http/list-subscriptions.controller.js';
import { registerConfirmRoute } from './modules/subscription/infrastructure/http/confirm.controller.js';
import { registerUnsubscribeRoute } from './modules/subscription/infrastructure/http/unsubscribe.controller.js';
import { registerHealthRoute } from './platform/http/health.controller.js';
import { registerMetricsRoute } from './platform/metrics/metrics.controller.js';
import { CommonErrorResponseDtoSchema } from './platform/http/response.dto.js';
import { type AppDependencies } from './dependencies.js';
import { msToSeconds } from './utils/time.utils.js';
import { REQUEST_ID_HEADER } from './platform/fastify/constants.js';
import { runWithRequestLogger } from './platform/logger/request-log-context.js';
import { OutboxRelayCron } from './platform/outbox/outbox-relay.cron.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class App {
  public readonly fastify: FastifyInstance;
  private readonly deps: AppDependencies;
  private readonly config: AppConfig;
  private outboxRelayCron?: OutboxRelayCron;

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

        return reply.status(status).send(body);
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
    registerHealthRoute(this.fastify);
    registerMetricsRoute(this.fastify, this.deps.metrics);

    await this.fastify.register(
      (fastify) => {
        const { subscription } = this.deps;

        registerSubscribeRoute(fastify, subscription.subscribeUseCase);
        registerListSubscriptionsRoute(
          fastify,
          subscription.getSubscriptionsByEmailUseCase,
        );
        registerConfirmRoute(fastify, subscription.confirmUseCase);
        registerUnsubscribeRoute(fastify, subscription.unsubscribeUseCase);
      },
      { prefix: this.config.apiPrefix },
    );
  }

  startScannerCron() {
    this.deps.scanner.startCron();
  }

  startOutboxRelayCron() {
    this.outboxRelayCron = new OutboxRelayCron(
      this.config.outboxRelayCron,
      this.deps.outboxRelay,
      this.deps.logger,
    );
    this.outboxRelayCron.start();
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
        await this.deps.scanner.stopCron();
        this.deps.logger.info('Scanner tasks stopped.');

        await this.outboxRelayCron?.stop();
        this.deps.logger.info('Outbox relay stopped.');

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
