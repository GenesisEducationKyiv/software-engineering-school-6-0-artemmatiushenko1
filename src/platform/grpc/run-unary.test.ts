import { describe, it, expect, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { InvalidEmailError } from '../../shared-kernel/errors.js';
import { runUnary } from './run-unary.js';

describe('runUnary', () => {
  it('should pass handler result to callback', async () => {
    const callback = vi.fn();

    await runUnary(callback, () => Promise.resolve({ ok: true }));

    expect(callback).toHaveBeenCalledWith(null, { ok: true });
  });

  it('should map domain errors to gRPC status', async () => {
    const callback = vi.fn();

    await runUnary(callback, () => {
      return Promise.reject(new InvalidEmailError('bad'));
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid email format: bad',
      }),
    );
  });

  it('should map unexpected errors to INTERNAL', async () => {
    const callback = vi.fn();

    await runUnary(callback, () => {
      return Promise.reject(new Error('boom'));
    });

    expect(callback).toHaveBeenCalledWith({
      code: grpc.status.INTERNAL,
      message: 'boom',
    });
  });
});
