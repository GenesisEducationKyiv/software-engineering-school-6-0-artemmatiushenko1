import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { InvalidEmailError } from '../../../../shared-kernel/errors.js';
import { SubscriptionNotFoundError } from '../../application/errors.js';
import { SubscriptionStatus } from '../../domain/subscription-status.js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { createSubscriptionServiceHandlers } from './subscription.service.js';
import {
  ConfirmRequest,
  ListSubscriptionsRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from './generated/subscription.js';
import { mock } from 'vitest-mock-extended';

const invokeUnary = <TRequest, TResponse>(
  handler: (
    call: grpc.ServerUnaryCall<TRequest, TResponse>,
    callback: grpc.sendUnaryData<TResponse>,
  ) => void,
  request: TRequest,
): Promise<{
  error: grpc.ServiceError | null;
  response: TResponse | undefined;
}> =>
  new Promise((resolve) => {
    handler(
      { request } as grpc.ServerUnaryCall<TRequest, TResponse>,
      (error, response) => {
        resolve({
          error: error ? (error as grpc.ServiceError) : null,
          response: response ?? undefined,
        });
      },
    );
  });

describe('subscription gRPC handlers', () => {
  const subscribeUseCase = { execute: vi.fn() };
  const confirmUseCase = { execute: vi.fn() };
  const unsubscribeUseCase = { execute: vi.fn() };
  const getSubscriptionsByEmailUseCase = { execute: vi.fn() };

  const module = mock<SubscriptionModule>({
    subscribeUseCase,
    confirmUseCase,
    unsubscribeUseCase,
    getSubscriptionsByEmailUseCase,
  });

  const handlers = createSubscriptionServiceHandlers(module);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('subscribe', () => {
    it('should delegate to subscribe use case and return success message', async () => {
      subscribeUseCase.execute.mockResolvedValue(undefined);

      const { error, response } = await invokeUnary(
        handlers.subscribe,
        SubscribeRequest.create({
          email: 'test@example.com',
          repo: 'owner/repo',
        }),
      );

      expect(error).toBeNull();
      expect(subscribeUseCase.execute).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
      );
      expect(response).toEqual({
        message: 'Subscription successful. Confirmation email sent.',
      });
    });

    it('should map domain errors to gRPC status', async () => {
      subscribeUseCase.execute.mockRejectedValue(new InvalidEmailError(''));

      const { error, response } = await invokeUnary(
        handlers.subscribe,
        SubscribeRequest.create({ email: '', repo: 'owner/repo' }),
      );

      expect(response).toBeUndefined();
      expect(error).toMatchObject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid email format: ',
      });
    });
  });

  describe('confirm', () => {
    it('should delegate to confirm use case and return success message', async () => {
      confirmUseCase.execute.mockResolvedValue(undefined);

      const { error, response } = await invokeUnary(
        handlers.confirm,
        ConfirmRequest.create({ token: 'confirm-token' }),
      );

      expect(error).toBeNull();
      expect(confirmUseCase.execute).toHaveBeenCalledWith('confirm-token');
      expect(response).toEqual({
        message: 'Subscription confirmed successfully',
      });
    });

    it('should map domain errors to gRPC status', async () => {
      confirmUseCase.execute.mockRejectedValue(new SubscriptionNotFoundError());

      const { error } = await invokeUnary(
        handlers.confirm,
        ConfirmRequest.create({ token: 'missing-token' }),
      );

      expect(error).toMatchObject({
        code: grpc.status.NOT_FOUND,
        message: 'Subscription not found',
      });
    });
  });

  describe('unsubscribe', () => {
    it('should delegate to unsubscribe use case and return success message', async () => {
      unsubscribeUseCase.execute.mockResolvedValue(undefined);

      const { error, response } = await invokeUnary(
        handlers.unsubscribe,
        UnsubscribeRequest.create({ token: 'unsubscribe-token' }),
      );

      expect(error).toBeNull();
      expect(unsubscribeUseCase.execute).toHaveBeenCalledWith(
        'unsubscribe-token',
      );
      expect(response).toEqual({ message: 'Unsubscribed successfully' });
    });
  });

  describe('listSubscriptions', () => {
    it('should map subscriptions to the gRPC response shape', async () => {
      getSubscriptionsByEmailUseCase.execute.mockResolvedValue([
        {
          email: { value: 'test@example.com' },
          repoPath: { toString: () => 'owner/confirmed' },
          status: SubscriptionStatus.Confirmed,
        },
        {
          email: { value: 'test@example.com' },
          repoPath: { toString: () => 'owner/pending' },
          status: SubscriptionStatus.Pending,
        },
      ]);

      const { error, response } = await invokeUnary(
        handlers.listSubscriptions,
        ListSubscriptionsRequest.create({ email: 'test@example.com' }),
      );

      expect(error).toBeNull();
      expect(getSubscriptionsByEmailUseCase.execute).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(response).toEqual({
        subscriptions: [
          {
            email: 'test@example.com',
            repo: 'owner/confirmed',
            confirmed: true,
          },
          {
            email: 'test@example.com',
            repo: 'owner/pending',
            confirmed: false,
          },
        ],
      });
    });

    it('should map domain errors to gRPC status', async () => {
      getSubscriptionsByEmailUseCase.execute.mockRejectedValue(
        new InvalidEmailError(''),
      );

      const { error } = await invokeUnary(
        handlers.listSubscriptions,
        ListSubscriptionsRequest.create({ email: '' }),
      );

      expect(error).toMatchObject({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid email format: ',
      });
    });
  });
});
