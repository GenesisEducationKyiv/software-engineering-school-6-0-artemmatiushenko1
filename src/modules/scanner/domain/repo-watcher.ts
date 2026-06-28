import type { Email } from '../../../shared-kernel/index.js';
import type { ReleaseTag } from './release-tag.js';

export type RepoWatcherParams = {
  subscriptionId: string;
  email: Email;
  unsubscribeToken: string;
  lastNotifiedTag: ReleaseTag | null;
};

export class RepoWatcher {
  readonly subscriptionId: string;
  readonly email: Email;
  readonly unsubscribeToken: string;
  private _lastNotifiedTag: ReleaseTag | null;

  private constructor(params: RepoWatcherParams) {
    this.subscriptionId = params.subscriptionId;
    this.email = params.email;
    this.unsubscribeToken = params.unsubscribeToken;
    this._lastNotifiedTag = params.lastNotifiedTag;
  }

  static create(params: RepoWatcherParams): RepoWatcher {
    return new RepoWatcher(params);
  }

  get lastNotifiedTag(): ReleaseTag | null {
    return this._lastNotifiedTag;
  }

  markNotified(tag: ReleaseTag): void {
    this._lastNotifiedTag = tag;
  }

  shouldNotifyFor(latestTag: ReleaseTag): boolean {
    if (this._lastNotifiedTag === null) {
      return true;
    }

    return !latestTag.equals(this._lastNotifiedTag);
  }
}
