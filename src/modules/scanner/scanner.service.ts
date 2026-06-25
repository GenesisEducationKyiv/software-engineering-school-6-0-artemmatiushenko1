import type { GithubClient } from '../../domain/github.js';
import type { Subscription } from '../subscription/domain/index.js';
import type { SubscriptionQueries } from '../subscription/api/subscription-queries.interface.js';
import type { NotificationService } from '../notification/api/notification.service.js';
import type { Clock, Logger } from '../../shared-kernel/index.js';
import { GithubRateLimitError } from '../../domain/errors.js';
import type { Metrics } from '../../domain/metrics.js';
import { msToSeconds } from '../../utils/time.utils.js';

export class ScannerService {
  constructor(
    private subscriptionQueries: SubscriptionQueries,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private logger: Logger,
    private clock: Clock,
    private metrics: Metrics,
  ) {}

  async scan(): Promise<void> {
    const startTime = this.clock.now().getTime();
    this.metrics.incrementScanTotal();

    try {
      const activeSubscriptions =
        await this.subscriptionQueries.findAllConfirmedSubscriptions();

      this.logger.info('Active subscriptions found for scan', {
        count: activeSubscriptions.length,
      });

      for (const sub of activeSubscriptions) {
        await this.safeScanSubscription(sub);
      }
    } finally {
      this.metrics.recordScanDuration(
        msToSeconds(this.clock.now().getTime() - startTime),
      );
    }
  }

  private async safeScanSubscription(sub: Subscription): Promise<void> {
    try {
      await this.processSubscription(sub);
    } catch (error) {
      this.metrics.incrementScanFailures();

      if (error instanceof GithubRateLimitError) {
        this.logger.warn(
          'GitHub API rate limit exceeded while scanning single subscription.',
        );
        throw error;
      }
      this.logger.error(
        'Error scanning subscription',
        error instanceof Error ? error : new Error(String(error)),
        {
          repo: sub.repoPath.toString(),
          subscriptionId: sub.id,
        },
      );
    }
  }

  private async processSubscription(sub: Subscription): Promise<void> {
    if (!sub.unsubscribeToken) {
      throw new Error('Unsubscribe token not found');
    }

    const repo = sub.repoPath.toString();
    const lastSeenTag = sub.lastSeenTag?.value ?? null;

    this.logger.info('Processing subscription', {
      subscriptionId: sub.id,
      repo,
      email: sub.email.value,
    });

    const latestRelease = await this.githubClient.getLatestRelease(
      sub.repoPath.owner,
      sub.repoPath.repo,
    );

    if (!latestRelease) {
      this.logger.info('No releases found', { repo });
      return;
    }

    if (latestRelease.tag !== lastSeenTag) {
      this.logger.info('New release detected', {
        repo,
        tag: latestRelease.tag,
        previousTag: lastSeenTag,
      });

      await this.notificationService.notifyNewRelease({
        email: sub.email.value,
        repo,
        tag: latestRelease.tag,
        releaseName: latestRelease.name,
        unsubscribeToken: sub.unsubscribeToken.value,
      });

      await this.subscriptionQueries.observeNewRelease(
        sub.id,
        latestRelease.tag,
      );
    } else {
      this.logger.info('No new releases', {
        repo,
        currentTag: lastSeenTag,
      });
    }
  }
}
