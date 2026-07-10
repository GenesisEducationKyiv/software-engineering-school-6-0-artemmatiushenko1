import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyBaseLogger } from 'fastify';

export interface RequestLoggerContext {
  log: FastifyBaseLogger;
}

export const requestLoggerContext =
  new AsyncLocalStorage<RequestLoggerContext>();

export function getRequestScopedLogger(): FastifyBaseLogger | undefined {
  return requestLoggerContext.getStore()?.log;
}

export function runWithRequestLogger<T>(
  log: FastifyBaseLogger,
  callback: () => T,
): T {
  return requestLoggerContext.run({ log }, callback);
}
