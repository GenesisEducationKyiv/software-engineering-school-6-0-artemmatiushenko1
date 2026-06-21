import fastify from 'fastify';
import { EXISTING_REPO, NON_EXISTING_REPO } from './constants.js';

const server = fastify({ logger: true });

server.get(
  `/repos/${EXISTING_REPO.owner}/${EXISTING_REPO.name}`,
  (_, reply) => {
    return reply.status(200).send();
  },
);

server.get(
  `/repos/${NON_EXISTING_REPO.owner}/${NON_EXISTING_REPO.name}`,
  (_, reply) => {
    return reply.status(404).send();
  },
);

server.get(
  `/repos/${EXISTING_REPO.owner}/${EXISTING_REPO.name}/releases/latest`,
  (_, reply) => {
    return reply.status(200).send({
      tag_name: 'v18.2.0',
      name: 'v18.2.0',
      published_at: '2022-06-14T17:15:21Z',
    });
  },
);

server.get('/health', () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 9090, host: '0.0.0.0' });
    console.log('GitHub mock server listening on port 9090');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

await start();
