import type { GithubClient } from '../domain/github.js';
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

    try {
      const activeSubscriptions =
        await this.subscriptionRepo.findAllConfirmedSubscriptions();

      this.logger.info(
        `Found ${activeSubscriptions.length} active subscriptions to scan.`,
      );

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
      await this.subscriptionRepo.findSubscriptionById(subscriptionId);
    if (!sub || !sub.confirmed) {
      this.logger.warn(
        `Attempted to scan non-existent or unconfirmed subscription: ${subscriptionId}`,
      );
      return;
    }

    this.logger.info(`Processing subscription for ${sub.repo} (${sub.email})`);
    const { owner, repo } = parseRepoPath(sub.repo);

    try {
      const latestRelease = await this.githubClient.getLatestRelease(
        owner,
        repo,
      );

      if (!latestRelease) {
        this.logger.info(`No releases found for ${sub.repo}`);
        return;
      }

      if (latestRelease.tag !== sub.lastSeenTag) {
        this.logger.info(
          `New release for ${sub.repo}: ${latestRelease.tag} (was ${sub.lastSeenTag ?? 'none'})`,
        );

        await this.notificationService.notifyNewRelease(sub, latestRelease);

        await this.subscriptionRepo.updateLastSeenTag(
          sub.id,
          latestRelease.tag,
        );
      } else {
        this.logger.info(
          `No new releases for ${sub.repo} (current: ${sub.lastSeenTag})`,
        );
      }
    } catch (error) {
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
      throw error;
    }
  }

  private recordScanDuration(durationSeconds: number): void {
    this.metrics?.recordScanDuration(durationSeconds);
  }
}
