import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import {
  Email,
  RepoPath,
  Subscription,
  SubscriptionStatus,
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../../domain/index.js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { createSubscriptionServiceHandlers } from './subscription.service.js';
import {
  ConfirmRequest,
  ListSubscriptionsRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from './generated/subscription.js';
import { mock } from 'vitest-mock-extended';
import type { SubscribeUseCase } from '../../application/use-cases/subscribe.use-case.js';
import type { ConfirmUseCase } from '../../application/use-cases/confirm.use-case.js';
import type { UnsubscribeUseCase } from '../../application/use-cases/unsubscribe.use-case.js';
import type { GetSubscriptionsByEmailUseCase } from '../../application/use-cases/get-subscriptions-by-email.use-case.js';

const tokenExpiresAt = new Date('2026-01-01T13:00:00Z');

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
  const subscribeUseCase = mock<SubscribeUseCase>();
  const confirmUseCase = mock<ConfirmUseCase>();
  const unsubscribeUseCase = mock<UnsubscribeUseCase>();
  const getSubscriptionsByEmailUseCase = mock<GetSubscriptionsByEmailUseCase>();

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

  it('should delegate subscribe to use case and return success message', async () => {
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

  it('should delegate confirm to use case and return success message', async () => {
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

  it('should delegate unsubscribe to use case and return success message', async () => {
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

  it('should map listSubscriptions to the gRPC response shape', async () => {
    getSubscriptionsByEmailUseCase.execute.mockResolvedValue([
      Subscription.rehydrate({
        id: '1',
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/confirmed'),
        status: SubscriptionStatus.Confirmed,
        confirmationToken: SubscriptionToken.rehydrate({
          value: '550e8400-e29b-41d4-a716-446655440000',
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: tokenExpiresAt,
        }),
        unsubscribeToken: SubscriptionToken.rehydrate({
          value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          scope: SubscriptionTokenScope.Unsubscribe,
          expiresAt: null,
        }),
      }),
      Subscription.rehydrate({
        id: '2',
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/pending'),
        status: SubscriptionStatus.Pending,
        confirmationToken: SubscriptionToken.rehydrate({
          value: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: tokenExpiresAt,
        }),
        unsubscribeToken: null,
      }),
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
});
