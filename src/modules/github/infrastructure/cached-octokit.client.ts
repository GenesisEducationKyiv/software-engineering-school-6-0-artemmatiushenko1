import type { Redis } from 'ioredis';
import type {
  GithubClient,
  GithubRelease,
} from '../api/github-client.interface.js';
import { GitHubReleaseSchema } from './github-release.schema.js';
import type { CacheMetrics } from '../api/cache-metrics.interface.js';

export class CachedOctokitGithubClient implements GithubClient {
  constructor(
    private readonly client: GithubClient,
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
    private readonly metrics?: CacheMetrics,
  ) {}

  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    const cacheKey = `github:repo-exists:${owner}:${repo}`;
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      this.metrics?.incrementCacheHit('repo-exists');
      return cached === 'true';
    }

    this.metrics?.incrementCacheMiss('repo-exists');
    const exists = await this.client.repositoryExists(owner, repo);
    await this.redis.set(cacheKey, String(exists), 'EX', this.ttlSeconds);

    return exists;
  }

  async getLatestRelease(
    owner: string,
    repo: string,
  ): Promise<GithubRelease | null> {
    const cacheKey = `github:latest-release:${owner}:${repo}`;
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      this.metrics?.incrementCacheHit('latest-release');
      if (cached === 'null') return null;
      return GitHubReleaseSchema.parse(JSON.parse(cached));
    }

    this.metrics?.incrementCacheMiss('latest-release');
    const release = await this.client.getLatestRelease(owner, repo);
    await this.redis.set(
      cacheKey,
      release ? JSON.stringify(release) : 'null',
      'EX',
      this.ttlSeconds,
    );

    return release;
  }
}
