import type { APIRequestContext } from '@playwright/test';
import { Redis } from 'ioredis';
import { EXISTING_REPO } from '../mocks/github/constants.js';

const GITHUB_MOCK_URL = 'http://github-mock:9090';

let redis: Redis | undefined;

const getRedis = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379');
  }
  return redis;
};

const invalidateLatestReleaseCache = async () => {
  await getRedis().del(
    `github:latest-release:${EXISTING_REPO.owner}:${EXISTING_REPO.name}`,
  );
};

export const resetGithubMockRelease = async (request: APIRequestContext) => {
  await request.post(`${GITHUB_MOCK_URL}/test/reset-release`);
  await invalidateLatestReleaseCache();
};

export const publishGithubMockRelease = async (
  request: APIRequestContext,
  tag: string,
  name?: string,
) => {
  await request.post(`${GITHUB_MOCK_URL}/test/publish-release`, {
    data: { tag, name: name ?? tag },
  });
  await invalidateLatestReleaseCache();
};
