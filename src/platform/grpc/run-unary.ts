import * as grpc from '@grpc/grpc-js';
import { isDomainError } from '../../shared-kernel/domain-error.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { resolveDomainErrorGrpc } from './domain-error-grpc.js';

export const runUnary = async <T>(
  callback: grpc.sendUnaryData<T>,
  handler: () => Promise<T>,
  logger: Logger,
): Promise<void> => {
  try {
    callback(null, await handler());
  } catch (error) {
    if (isDomainError(error)) {
      callback(resolveDomainErrorGrpc(error));
      return;
    }

    logger.error(
      'gRPC handler failed',
      error instanceof Error ? error : new Error(String(error)),
    );

    callback({
      code: grpc.status.INTERNAL,
      details: 'Internal server error',
    });
  }
};
