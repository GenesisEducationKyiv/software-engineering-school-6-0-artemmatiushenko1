import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from '../../shared-kernel/index.js';
import { getRequestScopedLogger } from './request-log-context.js';

export class FastifyLogger implements Logger {
  constructor(private baseLogger: FastifyBaseLogger) {}

  private resolveLogger(): FastifyBaseLogger {
    return getRequestScopedLogger() ?? this.baseLogger;
  }

  info(message: string, context?: Record<string, unknown>): void {
    const logger = this.resolveLogger();
    if (context) {
      logger.info(context, message);
    } else {
      logger.info(message);
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    const logger = this.resolveLogger();
    const payload = {
      ...(context || {}),
      ...(error ? { err: error } : {}),
    };

    if (Object.keys(payload).length > 0) {
      logger.error(payload, message);
    } else {
      logger.error(message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const logger = this.resolveLogger();
    if (context) {
      logger.warn(context, message);
    } else {
      logger.warn(message);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    const logger = this.resolveLogger();
    if (context) {
      logger.debug(context, message);
    } else {
      logger.debug(message);
    }
  }
}
