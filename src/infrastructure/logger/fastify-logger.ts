import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from '../../domain/logger.js';

export class FastifyLogger implements Logger {
  constructor(private fastifyLogger: FastifyBaseLogger) {}

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.fastifyLogger.info(context, message);
    } else {
      this.fastifyLogger.info(message);
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    const payload = {
      ...(context || {}),
      ...(error ? { err: error } : {}),
    };

    if (Object.keys(payload).length > 0) {
      this.fastifyLogger.error(payload, message);
    } else {
      this.fastifyLogger.error(message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.fastifyLogger.warn(context, message);
    } else {
      this.fastifyLogger.warn(message);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.fastifyLogger.debug(context, message);
    } else {
      this.fastifyLogger.debug(message);
    }
  }
}
