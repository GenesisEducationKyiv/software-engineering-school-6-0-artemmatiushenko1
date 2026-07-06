import * as grpc from '@grpc/grpc-js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { SubscriptionStatus } from '../../domain/index.js';
import { runUnary } from '../../../../platform/grpc/run-unary.js';
import type {
  ConfirmRequest,
  ListSubscriptionsRequest,
  ListSubscriptionsResponse,
  SubscribeRequest,
  SubscriptionServiceServer,
  SuccessResponse,
  UnsubscribeRequest,
} from './generated/subscription.js';

export const createSubscriptionServiceHandlers = (
  module: SubscriptionModule,
): SubscriptionServiceServer => ({
  subscribe: (
    call: grpc.ServerUnaryCall<SubscribeRequest, SuccessResponse>,
    callback: grpc.sendUnaryData<SuccessResponse>,
  ) => {
    const { email, repo } = call.request;

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
    const { token } = call.request;

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
    const { token } = call.request;

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
    const { email } = call.request;

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
