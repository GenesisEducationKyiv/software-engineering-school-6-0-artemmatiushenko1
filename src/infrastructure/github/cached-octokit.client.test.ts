import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import { CachedOctokitGithubClient } from './cached-octokit.client.js';
import type { GithubClient, GithubRelease } from '../../domain/github.js';
import type { Metrics } from '../../domain/metrics.js';
import { mock } from 'vitest-mock-extended';

describe('CachedOctokitGithubClient', () => {
  let cachedClient: CachedOctokitGithubClient;
  const githubClientMock = mock<GithubClient>();
  const redisMock = mock<Redis>();
  const metricsMock = mock<Metrics>();
  const TTL = 600;

  beforeEach(() => {
    vi.clearAllMocks();

    cachedClient = new CachedOctokitGithubClient(
      githubClientMock,
      redisMock,
      TTL,
      metricsMock,
    );
  });

  describe('repositoryExists', () => {
    it('should return cached value if present (hit)', async () => {
      redisMock.get.mockResolvedValue('true');

      const result = await cachedClient.repositoryExists('owner', 'repo');

      expect(result).toBe(true);
      expect(redisMock.get).toHaveBeenCalledWith(
        'github:repo-exists:owner:repo',
      );
      expect(githubClientMock.repositoryExists).not.toHaveBeenCalled();
      expect(metricsMock.incrementCacheHit).toHaveBeenCalledWith('repo-exists');
    });

    it('should fetch and cache value if not present (miss)', async () => {
      redisMock.get.mockResolvedValue(null);
      githubClientMock.repositoryExists.mockResolvedValue(true);

      const result = await cachedClient.repositoryExists('owner', 'repo');

      expect(result).toBe(true);
      expect(githubClientMock.repositoryExists).toHaveBeenCalledWith(
        'owner',
        'repo',
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        'github:repo-exists:owner:repo',
        'true',
        'EX',
        TTL,
      );
      expect(metricsMock.incrementCacheMiss).toHaveBeenCalledWith(
        'repo-exists',
      );
    });
  });

  describe('getLatestRelease', () => {
    it('should return cached release if present (hit)', async () => {
      const release: GithubRelease = {
        tag: 'v1.0.0',
        name: 'Release 1',
        publishedAt: '2023-01-01T00:00:00Z',
      };
      redisMock.get.mockResolvedValue(JSON.stringify(release));

      const result = await cachedClient.getLatestRelease('owner', 'repo');

      expect(result).toEqual(release);
      expect(metricsMock.incrementCacheHit).toHaveBeenCalledWith(
        'latest-release',
      );
      expect(githubClientMock.getLatestRelease).not.toHaveBeenCalled();
    });

    it('should fetch and cache release if not present (miss)', async () => {
      const release: GithubRelease = {
        tag: 'v1.0.0',
        name: 'Release 1',
        publishedAt: '2023-01-01T00:00:00Z',
      };
      redisMock.get.mockResolvedValue(null);
      githubClientMock.getLatestRelease.mockResolvedValue(release);

      const result = await cachedClient.getLatestRelease('owner', 'repo');

      expect(result).toEqual(release);
      expect(githubClientMock.getLatestRelease).toHaveBeenCalledWith(
        'owner',
        'repo',
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        'github:latest-release:owner:repo',
        JSON.stringify(release),
        'EX',
        TTL,
      );
      expect(metricsMock.incrementCacheMiss).toHaveBeenCalledWith(
        'latest-release',
      );
    });

    it('should handle cached null values', async () => {
      redisMock.get.mockResolvedValue('null');

      const result = await cachedClient.getLatestRelease('owner', 'repo');

      expect(result).toBeNull();
      expect(metricsMock.incrementCacheHit).toHaveBeenCalledWith(
        'latest-release',
      );
    });
  });
});
