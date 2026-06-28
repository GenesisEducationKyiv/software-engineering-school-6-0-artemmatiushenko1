import { EmptyMonitoredRepoError, RepoWatcherNotFoundError } from './errors.js';
import { RepoWatcher } from './repo-watcher.js';
import type { ReleaseTag, RepoPath } from '../../../shared-kernel/index.js';

export type MonitoredRepoParams = {
  repo: RepoPath;
  lastSeenTag: ReleaseTag | null;
  watchers: RepoWatcher[];
};

export class MonitoredRepo {
  readonly repo: RepoPath;
  private _lastSeenTag: ReleaseTag | null;
  private readonly _watchers: RepoWatcher[];

  private constructor(params: MonitoredRepoParams) {
    this.repo = params.repo;
    this._lastSeenTag = params.lastSeenTag;
    this._watchers = [...params.watchers];
  }

  static create(repo: RepoPath): MonitoredRepo {
    return new MonitoredRepo({ repo, lastSeenTag: null, watchers: [] });
  }

  static rehydrate(params: MonitoredRepoParams): MonitoredRepo {
    if (params.watchers.length === 0) {
      throw new EmptyMonitoredRepoError(params.repo.toString());
    }

    return new MonitoredRepo(params);
  }

  get lastSeenTag(): ReleaseTag | null {
    return this._lastSeenTag;
  }

  get watchers(): readonly RepoWatcher[] {
    return this._watchers;
  }

  addWatcher(watcher: RepoWatcher): void {
    const existingIndex = this._watchers.findIndex(
      (existing) => existing.subscriptionId === watcher.subscriptionId,
    );

    if (existingIndex === -1) {
      this._watchers.push(watcher);
      return;
    }

    this._watchers[existingIndex] = watcher;
  }

  removeWatcher(watcher: RepoWatcher): boolean {
    const index = this._watchers.findIndex(
      (existing) => existing.subscriptionId === watcher.subscriptionId,
    );

    if (index === -1) {
      return this._watchers.length === 0;
    }

    this._watchers.splice(index, 1);
    return this._watchers.length === 0;
  }

  hasNewRelease(latestTag: ReleaseTag): boolean {
    if (this._lastSeenTag === null) {
      return true;
    }

    return !latestTag.equals(this._lastSeenTag);
  }

  eligibleWatchers(latestTag: ReleaseTag): RepoWatcher[] {
    return this._watchers.filter((watcher) =>
      watcher.shouldNotifyFor(latestTag),
    );
  }

  markReleaseSeen(latestTag: ReleaseTag): void {
    this._lastSeenTag = latestTag;
  }

  markWatcherNotified(subscriptionId: string, tag: ReleaseTag): void {
    const watcher = this._watchers.find(
      (existing) => existing.subscriptionId === subscriptionId,
    );

    if (!watcher) {
      throw new RepoWatcherNotFoundError(subscriptionId, this.repo.toString());
    }

    watcher.markNotified(tag);
  }
}
