import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

export const subscriptionProtoPath = path.join(
  projectRoot,
  'src/modules/subscription/api/subscription.proto',
);

const loaderOptions: protoLoader.Options = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export const loadSubscriptionPackageDefinition = () =>
  protoLoader.loadSync(subscriptionProtoPath, loaderOptions);

export const loadSubscriptionGrpcDefinition = () =>
  grpc.loadPackageDefinition(loadSubscriptionPackageDefinition());
