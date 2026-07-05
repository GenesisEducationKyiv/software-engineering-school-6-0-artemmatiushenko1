import type * as grpc from '@grpc/grpc-js';
import { loadSubscriptionGrpcDefinition } from '../../../../platform/grpc/load-proto.js';
import type { SubscriptionModule } from '../../subscription.module.js';
import { createSubscriptionServiceHandlers } from './subscription.service.js';

type SubscriptionGrpcPackage = {
  subscription: {
    v1: {
      SubscriptionService: {
        service: grpc.ServiceDefinition;
      };
    };
  };
};

export const registerSubscriptionGrpc = (
  server: grpc.Server,
  subscriptionModule: SubscriptionModule,
): void => {
  const definition =
    loadSubscriptionGrpcDefinition() as unknown as SubscriptionGrpcPackage;

  server.addService(
    definition.subscription.v1.SubscriptionService.service,
    createSubscriptionServiceHandlers(subscriptionModule),
  );
};
