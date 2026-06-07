import type { GithubClient } from '../../domain/github.js';
import { parseRepoPath } from '../../utils/repo.utils.js';
import { NotificationService } from '../notification/notification.service.js';
import type { SubscriptionService } from '../subscription/subscription.service.js';
import type { Logger } from '../../domain/logger.js';
import {
  GithubRateLimitError,
  TokenNotFoundError,
} from '../../domain/errors.js';
import type { Metrics } from '../../domain/metrics.js';

export class ScannerService {
  constructor(
    private subscriptionService: SubscriptionService,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private logger: Logger,
    private metrics?: Metrics,
  ) {}

  async scan(): Promise<void> {
    const startTime = Date.now();
    this.metrics?.incrementScanTotal();

    try {
      const activeSubscriptions =
        await this.subscriptionService.findAllConfirmedSubscriptions();

      this.logger.info('Active subscriptions found for scan', {
        count: activeSubscriptions.length,
      });

      for (const sub of activeSubscriptions) {
        await this.scanSubscription(sub.id);
      }
    } catch (error) {
      this.metrics?.incrementScanFailures();
      throw error;
    } finally {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.recordScanDuration(durationSeconds);
    }
  }

  async scanSubscription(subscriptionId: number): Promise<void> {
    const sub =
      await this.subscriptionService.findSubscriptionById(subscriptionId);
    if (!sub || !sub.confirmed) {
      this.logger.warn('Skipped scan for invalid subscription', {
        subscriptionId,
      });
      return;
    }

    this.logger.info('Processing subscription', {
      subscriptionId: sub.id,
      repo: sub.repo,
      email: sub.email,
    });
    const { owner, repo } = parseRepoPath(sub.repo);

    try {
      const latestRelease = await this.githubClient.getLatestRelease(
        owner,
        repo,
      );

      if (!latestRelease) {
        this.logger.info('No releases found', { repo: sub.repo });
        return;
      }

      if (latestRelease.tag !== sub.lastSeenTag) {
        this.logger.info('New release detected', {
          repo: sub.repo,
          tag: latestRelease.tag,
          previousTag: sub.lastSeenTag ?? null,
        });

        await this.notificationService.notifyNewRelease({
          email: sub.email,
          repo: sub.repo,
          tag: latestRelease.tag,
          releaseName: latestRelease.name,
          unsubscribeToken: await this.resolveUnsubscribeToken(sub.id),
        });

        await this.subscriptionService.updateLastSeenTag(
          sub.id,
          latestRelease.tag,
        );
      } else {
        this.logger.info('No new releases', {
          repo: sub.repo,
          currentTag: sub.lastSeenTag,
        });
      }
    } catch (error) {
      if (error instanceof GithubRateLimitError) {
        this.logger.warn(
          'GitHub API rate limit exceeded while scanning single subscription.',
        );
        throw error;
      }
      this.logger.error(
        'Error scanning subscription',
        error instanceof Error ? error : new Error(String(error)),
        { repo: sub.repo, subscriptionId: sub.id },
      );
      throw error;
    }
  }

  private recordScanDuration(durationSeconds: number): void {
    this.metrics?.recordScanDuration(durationSeconds);
  }

  private async resolveUnsubscribeToken(
    subscriptionId: number,
  ): Promise<string> {
    const token =
      await this.subscriptionService.getUnsubscribeToken(subscriptionId);

    if (!token) {
      throw new TokenNotFoundError(
        `No unsubscribe token found for subscription ${subscriptionId}`,
      );
    }

    return token.token;
  }
}
