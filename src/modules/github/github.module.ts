import type { Redis } from 'ioredis';
import type { GithubClient } from './api/github-client.interface.js';
import type { CacheMetrics } from './api/cache-metrics.interface.js';
import type { GithubConfig } from './config.js';
import { CachedOctokitGithubClient } from './infrastructure/cached-octokit.client.js';
import { OctokitGithubClient } from './infrastructure/octokit.client.js';

export type GithubModuleDeps = {
  githubClient:
    | {
        source: 'client';
        instance: GithubClient;
      }
    | {
        source: 'config';
        config: GithubConfig;
        redis: Redis;
        metrics: CacheMetrics;
      };
};

export class GithubModule {
  readonly githubClient: GithubClient;

  private constructor(githubClient: GithubClient) {
    this.githubClient = githubClient;
  }

  static create(deps: GithubModuleDeps): GithubModule {
    const githubClient =
      deps.githubClient.source === 'client'
        ? deps.githubClient.instance
        : new CachedOctokitGithubClient(
            new OctokitGithubClient(
              deps.githubClient.config.githubApiBaseUrl,
              deps.githubClient.config.githubToken,
            ),
            deps.githubClient.redis,
            deps.githubClient.config.githubCacheTtl,
            deps.githubClient.metrics,
          );

    return new GithubModule(githubClient);
  }
}
