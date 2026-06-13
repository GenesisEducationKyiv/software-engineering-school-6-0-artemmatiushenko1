import type { GithubClient } from '../domain/github.js';
import type { Subscription } from '../domain/subscription.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import { parseRepoPath } from '../utils/repo.utils.js';
import { NotificationService } from './notification.service.js';
import type { Logger } from '../domain/logger.js';
import { GithubRateLimitError } from '../domain/errors.js';
import type { Metrics } from '../domain/metrics.js';

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

    const activeSubscriptions =
      await this.subscriptionRepo.findAllConfirmedSubscriptions();

    this.logger.info(
      `Found ${activeSubscriptions.length} active subscriptions to scan.`,
    );

    for (const sub of activeSubscriptions) {
      await this.safeScanSubscription(sub);
    }
    const durationSeconds = (Date.now() - startTime) / 1000;
    this.recordScanDuration(durationSeconds);
  }

  async safeScanSubscription(sub: Subscription): Promise<void> {
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
        `Error scanning ${sub.repo}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async scanSubscription(sub: Subscription): Promise<void> {
    this.logger.info(`Processing subscription for ${sub.repo} (${sub.email})`);
    const { owner, repo } = parseRepoPath(sub.repo);

    const latestRelease = await this.githubClient.getLatestRelease(owner, repo);

    if (!latestRelease) {
      this.logger.info(`No releases found for ${sub.repo}`);
      return;
    }

    if (latestRelease.tag !== sub.lastSeenTag) {
      this.logger.info(
        `New release for ${sub.repo}: ${latestRelease.tag} (was ${sub.lastSeenTag ?? 'none'})`,
      );

      await this.notificationService.notifyNewRelease(sub, latestRelease);

      await this.subscriptionRepo.updateLastSeenTag(sub.id, latestRelease.tag);
    } else {
      this.logger.info(
        `No new releases for ${sub.repo} (current: ${sub.lastSeenTag})`,
      );
    }
  }

  private recordScanDuration(durationSeconds: number): void {
    this.metrics?.recordScanDuration(durationSeconds);
  }
}
