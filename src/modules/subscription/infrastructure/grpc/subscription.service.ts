import * as grpc from '@grpc/grpc-js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { SubscriptionStatus } from '../../domain/index.js';
import {
  isDomainError,
  resolveDomainErrorGrpc,
} from '../../../../platform/grpc/domain-error-grpc.js';

type SubscribeRequest = { email?: string; repo?: string };
type ConfirmRequest = { token?: string };
type UnsubscribeRequest = { token?: string };
type ListSubscriptionsRequest = { email?: string };
type SuccessResponse = { message: string };
type SubscriptionMessage = {
  email: string;
  repo: string;
  confirmed: boolean;
  lastSeenTag?: string;
};
type ListSubscriptionsResponse = { subscriptions: SubscriptionMessage[] };

const runUnary = async <T>(
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
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

export const createSubscriptionServiceHandlers = (
  module: SubscriptionModule,
): grpc.UntypedServiceImplementation => ({
  subscribe: (
    call: grpc.ServerUnaryCall<SubscribeRequest, SuccessResponse>,
    callback: grpc.sendUnaryData<SuccessResponse>,
  ) => {
    const { email = '', repo = '' } = call.request;

    void runUnary(callback, async () => {
      await module.subscribeUseCase.execute(email, repo);

      return {
        message: 'Subscription successful. Confirmation email sent.',
      };
    });
  },

  confirm: (
    call: grpc.ServerUnaryCall<ConfirmRequest, SuccessResponse>,
    callback: grpc.sendUnaryData<SuccessResponse>,
  ) => {
    const { token = '' } = call.request;

    void runUnary(callback, async () => {
      await module.confirmUseCase.execute(token);

      return {
        message: 'Subscription confirmed successfully',
      };
    });
  },

  unsubscribe: (
    call: grpc.ServerUnaryCall<UnsubscribeRequest, SuccessResponse>,
    callback: grpc.sendUnaryData<SuccessResponse>,
  ) => {
    const { token = '' } = call.request;

    void runUnary(callback, async () => {
      await module.unsubscribeUseCase.execute(token);

      return {
        message: 'Unsubscribed successfully',
      };
    });
  },

  listSubscriptions: (
    call: grpc.ServerUnaryCall<
      ListSubscriptionsRequest,
      ListSubscriptionsResponse
    >,
    callback: grpc.sendUnaryData<ListSubscriptionsResponse>,
  ) => {
    const { email = '' } = call.request;

    void runUnary(callback, async () => {
      const subscriptions =
        await module.getSubscriptionsByEmailUseCase.execute(email);

      return {
        subscriptions: subscriptions.map((subscription) => ({
          email: subscription.email.value,
          repo: subscription.repoPath.toString(),
          confirmed: subscription.status === SubscriptionStatus.Confirmed,
        })),
      };
    });
  },
});
