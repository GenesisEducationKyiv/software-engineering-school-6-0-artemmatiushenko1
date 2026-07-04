import type { GithubClient } from '../../github/api/github-client.interface.js';
import type { Clock, Logger } from '../../../shared-kernel/index.js';
import { ReleaseTag, type MonitoredRepo } from '../domain/index.js';
import type { MonitoredRepoRepository } from './ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../shared-kernel/transaction.js';
import { GithubRateLimitError } from '../../github/domain/errors.js';
import type { ScannerMetrics } from './ports/scanner-metrics.interface.js';
import { msToSeconds } from '../../../utils/time.utils.js';
import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { ScannerEventType } from '../api/events.js';
import type { DomainEventEnvelope } from '../../../platform/event-bus/domain-event-envelope.js';

export class ScanUseCase {
  constructor(
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
    private readonly githubClient: GithubClient,
    private readonly logger: Logger,
    private readonly clock: Clock,
    private readonly metrics: ScannerMetrics,
    private readonly eventBus: EventBus,
  ) {}

  async execute(): Promise<void> {
    const startTime = this.clock.now().getTime();
    this.metrics.incrementScanTotal();

    try {
      const monitoredRepos = await this.monitoredRepoRepository.findAll();

      this.logger.info('Monitored repos found for scan', {
        count: monitoredRepos.length,
      });

      for (const monitoredRepo of monitoredRepos) {
        await this.safeScanRepo(monitoredRepo);
      }
    } finally {
      this.metrics.recordScanDuration(
        msToSeconds(this.clock.now().getTime() - startTime),
      );
    }
  }

  private async safeScanRepo(monitoredRepo: MonitoredRepo): Promise<void> {
    const repo = monitoredRepo.repo.toString();

    try {
      await this.detectRelease(monitoredRepo);
    } catch (error) {
      this.metrics.incrementScanFailures();

      if (error instanceof GithubRateLimitError) {
        this.logger.warn(
          'GitHub API rate limit exceeded while scanning a repository.',
        );
        throw error;
      }

      this.logger.error(
        'Error scanning repository',
        error instanceof Error ? error : new Error(String(error)),
        { repo },
      );
    }
  }

  private async detectRelease(monitoredRepo: MonitoredRepo): Promise<void> {
    const repo = monitoredRepo.repo.toString();

    this.logger.info('Processing monitored repo', {
      repo,
      watcherCount: monitoredRepo.watchers.length,
    });

    const latestRelease = await this.githubClient.getLatestRelease(
      monitoredRepo.repo.owner,
      monitoredRepo.repo.repo,
    );

    if (!latestRelease) {
      this.logger.info('No releases found', { repo });
      return;
    }

    const latestTag = ReleaseTag.fromString(latestRelease.tag);

    if (!monitoredRepo.hasNewRelease(latestTag)) {
      this.logger.info('No new releases', {
        repo,
        currentTag: monitoredRepo.lastSeenTag?.value ?? null,
      });
      return;
    }

    this.logger.info('New release detected', {
      repo,
      tag: latestRelease.tag,
      previousTag: monitoredRepo.lastSeenTag?.value ?? null,
    });

    const eligibleWatchers = monitoredRepo.eligibleWatchers(latestTag);

    const newReleaseEvents: DomainEventEnvelope[] = [];

    for (const watcher of eligibleWatchers) {
      newReleaseEvents.push({
        type: ScannerEventType.NewReleaseDetected,
        aggregateId: watcher.subscriptionId,
        occurredAt: this.clock.now().toISOString(),
        payload: {
          repo,
          tag: latestRelease.tag,
          releaseName: latestRelease.name ?? latestRelease.tag,
        },
      });
    }

    if (newReleaseEvents.length > 0) {
      await this.eventBus.publish(newReleaseEvents);
    }

    monitoredRepo.markReleaseSeen(latestTag);
    monitoredRepo.markWatcherNotified(eligibleWatchers, latestTag);

    await this.transactionManager.run(async (tx) => {
      await this.monitoredRepoRepository.save(monitoredRepo, tx);
    });
  }
}
