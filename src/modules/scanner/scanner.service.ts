import type { GithubClient } from '../../domain/github.js';
import type { Subscription } from '../subscription/domain/index.js';
import type { SubscriptionService } from '../../domain/subscription.js';
import type { NotificationService } from '../../domain/notification.js';
import type { Logger } from '../../domain/shared/index.js';
import { GithubRateLimitError } from '../../domain/errors.js';
import type { Metrics } from '../../domain/metrics.js';
import { msToSeconds } from '../../utils/time.utils.js';
import { RepoPath } from '../subscription/domain/repo-path.js';

type ScannableSubscription = {
  id: string;
  email: string;
  repo: string;
  lastSeenTag: string | null;
  unsubscribeToken: string;
};

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
        await this.safeScanSubscription(sub);
      }
    } finally {
      this.metrics?.recordScanDuration(msToSeconds(Date.now() - startTime));
    }
  }

  private async safeScanSubscription(sub: Subscription): Promise<void> {
    try {
      await this.processSubscription(this.toScannableFromDomain(sub));
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
        {
          repo: sub.repoPath.toString(),
          subscriptionId: sub.id,
        },
      );
    }
  }

  private async processSubscription(sub: ScannableSubscription): Promise<void> {
    this.logger.info('Processing subscription', {
      subscriptionId: sub.id,
      repo: sub.repo,
      email: sub.email,
    });
    const repoPath = RepoPath.fromString(sub.repo);

    const latestRelease = await this.githubClient.getLatestRelease(
      repoPath.owner,
      repoPath.repo,
    );

    if (!latestRelease) {
      this.logger.info('No releases found', { repo: sub.repo });
      return;
    }

    if (latestRelease.tag !== sub.lastSeenTag) {
      this.logger.info('New release detected', {
        repo: sub.repo,
        tag: latestRelease.tag,
        previousTag: sub.lastSeenTag,
      });

      await this.notificationService.notifyNewRelease({
        email: sub.email,
        repo: sub.repo,
        tag: latestRelease.tag,
        releaseName: latestRelease.name,
        unsubscribeToken: sub.unsubscribeToken,
      });

      await this.subscriptionService.observeNewRelease(
        sub.id,
        latestRelease.tag,
      );
    } else {
      this.logger.info('No new releases', {
        repo: sub.repo,
        currentTag: sub.lastSeenTag,
      });
    }
  }

  private toScannableFromDomain(sub: Subscription): ScannableSubscription {
    if (!sub.unsubscribeToken) {
      throw new Error('Unsubscribe token not found');
    }

    return {
      id: sub.id,
      email: sub.email.email,
      repo: sub.repoPath.toString(),
      lastSeenTag: sub.lastSeenTag?.value ?? null,
      unsubscribeToken: sub.unsubscribeToken?.value,
    };
  }
}
