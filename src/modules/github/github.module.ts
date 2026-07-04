import type { Redis } from 'ioredis';
import type { GithubClient } from './api/github-client.interface.js';
import type { CacheMetrics } from './api/cache-metrics.interface.js';
import { CachedOctokitGithubClient } from './infrastructure/cached-octokit.client.js';
import { OctokitGithubClient } from './infrastructure/octokit.client.js';

export type GithubModuleDeps =
  | { kind: 'client'; githubClient: GithubClient }
  | {
      kind: 'config';
      githubApiBaseUrl: string;
      githubToken?: string;
      githubCacheTtl: number;
      redis: Redis;
      metrics: CacheMetrics;
    };

export class GithubModule {
  readonly githubClient: GithubClient;

  private constructor(githubClient: GithubClient) {
    this.githubClient = githubClient;
  }

  static create(deps: GithubModuleDeps): GithubModule {
    if (deps.kind === 'client') {
      return new GithubModule(deps.githubClient);
    }

    return new GithubModule(
      new CachedOctokitGithubClient(
        new OctokitGithubClient(deps.githubApiBaseUrl, deps.githubToken),
        deps.redis,
        deps.githubCacheTtl,
        deps.metrics,
      ),
    );
  }
}
