import type { GithubClient } from '../domain/github.js';
import type { Subscription } from '../domain/subscription.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import { parseRepoPath } from '../utils/repo.utils.js';
import { NotificationService } from './notification.service.js';
import type { Logger } from '../domain/logger.js';
import { GithubRateLimitError } from '../domain/errors.js';
import type { Metrics } from '../domain/metrics.js';
import { msToSeconds } from '../utils/time.utils.js';

export class ScannerService {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
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
        await this.subscriptionRepo.findAllConfirmedSubscriptions();

      this.logger.info('Active subscriptions found for scan', {
        count: activeSubscriptions.length,
      });

      for (const sub of activeSubscriptions) {
        await this.safeScanSubscription(sub);
      }
    } finally {
      const endTime = Date.now();
      this.metrics?.recordScanDuration(msToSeconds(endTime - startTime));
    }
  }

  private async safeScanSubscription(sub: Subscription): Promise<void> {
    try {
      await this.scanSubscription(sub);
    } catch (error) {
      this.metrics?.incrementScanFailures();

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
    }
  }

  private async scanSubscription(sub: Subscription): Promise<void> {
    this.logger.info('Processing subscription', {
      subscriptionId: sub.id,
      repo: sub.repo,
      email: sub.email,
    });
    const { owner, repo } = parseRepoPath(sub.repo);

    const latestRelease = await this.githubClient.getLatestRelease(owner, repo);

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

      await this.notificationService.notifyNewRelease(sub, latestRelease);

      await this.subscriptionRepo.updateLastSeenTag(sub.id, latestRelease.tag);
    } else {
      this.logger.info('No new releases', {
        repo: sub.repo,
        currentTag: sub.lastSeenTag,
      });
    }
  }
}
