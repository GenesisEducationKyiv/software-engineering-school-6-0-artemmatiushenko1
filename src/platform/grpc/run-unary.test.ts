import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import * as grpc from '@grpc/grpc-js';
import { InvalidEmailError } from '../../shared-kernel/errors.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { runUnary } from './run-unary.js';

const logger = mock<Logger>();

describe('runUnary', () => {
  it('should pass handler result to callback', async () => {
    const callback = vi.fn();

    await runUnary(callback, () => Promise.resolve({ ok: true }), logger);

    expect(callback).toHaveBeenCalledWith(null, { ok: true });
  });

  it('should map domain errors to gRPC status', async () => {
    const callback = vi.fn();

    await runUnary(
      callback,
      () => {
        return Promise.reject(new InvalidEmailError('bad'));
      },
      logger,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        code: grpc.status.INVALID_ARGUMENT,
        details: 'Invalid email format: bad',
      }),
    );
  });

  it('should map unexpected errors to INTERNAL', async () => {
    const callback = vi.fn();
    const error = new Error('boom');

    await runUnary(
      callback,
      () => {
        return Promise.reject(error);
      },
      logger,
    );

    expect(logger.error).toHaveBeenCalledWith('gRPC handler failed', error);
    expect(callback).toHaveBeenCalledWith({
      code: grpc.status.INTERNAL,
      details: 'Internal server error',
    });
  });
});
