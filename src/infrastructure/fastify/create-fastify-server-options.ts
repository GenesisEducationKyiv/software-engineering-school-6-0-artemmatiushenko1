import type { FastifyServerOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config.js';
import { createFastifyLoggerOptions } from '../logger/create-fastify-logger-options.js';

export function createFastifyServerOptions(
  config: AppConfig,
): FastifyServerOptions {
  return {
    logger: createFastifyLoggerOptions(config),
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => randomUUID(),
  };
}
