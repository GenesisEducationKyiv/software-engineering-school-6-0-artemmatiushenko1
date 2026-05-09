import { Octokit } from 'octokit';
import type { GithubClient, GithubRelease } from '../../domain/github.js';
import { RequestError } from '@octokit/request-error';
import { GithubRateLimitError } from '../../domain/errors.js';

export class OctokitGithubClient implements GithubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner,
        repo,
      });
      return true;
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 404) {
          return false;
        }
        if (error.status === 429) {
          throw new GithubRateLimitError();
        }
      }
      throw error;
    }
  }

  async getLatestRelease(
    owner: string,
    repo: string,
  ): Promise<GithubRelease | null> {
    try {
      const { data } = await this.octokit.rest.repos.getLatestRelease({
        owner,
        repo,
      });

      return {
        tag: data.tag_name,
        name: data.name ?? null,
        publishedAt: data.published_at ?? null,
      };
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 404) {
          return null;
        }
        if (error.status === 429) {
          throw new GithubRateLimitError();
        }
      }
      throw error;
    }
  }
}
