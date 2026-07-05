import type * as grpc from '@grpc/grpc-js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { SubscriptionServiceService } from './generated/subscription.js';
import { createSubscriptionServiceHandlers } from './subscription.service.js';

export const registerSubscriptionGrpc = (
  server: grpc.Server,
  subscriptionModule: SubscriptionModule,
): void => {
  server.addService(
    SubscriptionServiceService,
    createSubscriptionServiceHandlers(subscriptionModule),
  );
};
