import fastify from 'fastify';
import {
  EXISTING_REPO,
  INITIAL_RELEASE,
  NON_EXISTING_REPO,
  type ReleaseFixture,
} from './constants.js';

const server = fastify({ logger: true });

let latestRelease: ReleaseFixture = { ...INITIAL_RELEASE };

const toGithubRelease = (release: ReleaseFixture) => ({
  tag_name: release.tag,
  name: release.name,
  published_at: release.publishedAt,
});

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
    return reply.status(200).send(toGithubRelease(latestRelease));
  },
);

server.post('/test/reset-release', (_, reply) => {
  latestRelease = { ...INITIAL_RELEASE };
  return reply.send({ ok: true, release: latestRelease });
});

server.post<{ Body: { tag: string; name?: string; publishedAt?: string } }>(
  '/test/publish-release',
  (request, reply) => {
    const { tag, name, publishedAt } = request.body;
    latestRelease = {
      tag,
      name: name ?? tag,
      publishedAt: publishedAt ?? new Date().toISOString(),
    };
    return reply.send({ ok: true, release: latestRelease });
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
