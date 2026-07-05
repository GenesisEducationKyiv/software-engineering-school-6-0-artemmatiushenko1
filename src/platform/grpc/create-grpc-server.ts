import * as grpc from '@grpc/grpc-js';

export const createGrpcServer = (): grpc.Server => new grpc.Server();

export const bindGrpcServer = (
  server: grpc.Server,
  address: string,
): Promise<number> =>
  new Promise((resolve, reject) => {
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      },
    );
  });

export const shutdownGrpcServer = (server: grpc.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.tryShutdown((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
