import * as grpc from '@grpc/grpc-js';
import { isDomainError } from '../../shared-kernel/domain-error.js';
import { resolveDomainErrorGrpc } from './domain-error-grpc.js';

export const runUnary = async <T>(
  callback: grpc.sendUnaryData<T>,
  handler: () => Promise<T>,
): Promise<void> => {
  try {
    callback(null, await handler());
  } catch (error) {
    if (isDomainError(error)) {
      callback(resolveDomainErrorGrpc(error));
      return;
    }

    callback({
      code: grpc.status.INTERNAL,
      details: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};
