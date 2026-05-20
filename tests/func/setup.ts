import { beforeAll, beforeEach } from 'vitest';
import { buildApp, type AppInstance } from '../../src/index.js';
import { InMemoryEmailService } from './pkg/email.js';
import { GitHubTestServer } from './pkg/github-server.js';
import { OctokitGithubClient } from '../../src/infrastructure/github/octokit.client.js';
import { truncateTables } from './pkg/db.js';
import { setBaseUrl } from './pkg/http.js';
import type { AddressInfo } from 'net';

export const emailService = new InMemoryEmailService();
export const ghServer = new GitHubTestServer();

let appInstance: AppInstance | null = null;

beforeAll(async () => {
  if (appInstance) return;

  await ghServer.start();

  appInstance = await buildApp({
    emailService,
    githubClient: new OctokitGithubClient(undefined, ghServer.baseUrl),
    disableCron: true,
  });
  await appInstance.fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = appInstance.fastify.server.address() as AddressInfo;
  setBaseUrl(`http://127.0.0.1:${port}`);
});

beforeEach(async () => {
  await truncateTables();
  emailService.reset();
  ghServer.reset();
  ghServer.repoExists('owner', 'repo');
});
