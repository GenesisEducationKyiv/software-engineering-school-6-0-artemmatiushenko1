import type { ConfirmationToken } from './confirmation-token.js';
import type { Email } from './email.js';
import { IllegalStateTransitionError, WrongTokenScopeError } from './errors.js';
import type { ReleaseTag } from './release-tag.js';
import type { RepoPath } from './repo-path.js';

export type SubscriptionStatus = 'pending' | 'confirmed' | 'unsubscribed';

export class Subscription {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly repoPath: RepoPath,
    private _status: SubscriptionStatus,
    private _lastSeenTag: ReleaseTag | null,
    private confirmationToken: ConfirmationToken,
    private unsubscribeToken: ConfirmationToken | null,
  ) {}

  static rehydrate(params: {
    id: string;
    email: Email;
    repoPath: RepoPath;
    status: SubscriptionStatus;
    lastSeenTag: ReleaseTag | null;
    confirmationToken: ConfirmationToken;
    unsubscribeToken: ConfirmationToken | null;
  }): Subscription {
    return new Subscription(
      params.id,
      params.email,
      params.repoPath,
      params.status,
      params.lastSeenTag,
      params.confirmationToken,
      params.unsubscribeToken,
    );
  }

  static request(
    id: string,
    email: Email,
    repoPath: RepoPath,
    confirmationToken: ConfirmationToken,
  ): Subscription {
    if (confirmationToken.scope !== 'subscribe') {
      throw new WrongTokenScopeError('subscribe', confirmationToken.scope);
    }

    return new Subscription(
      id,
      email,
      repoPath,
      'pending',
      null,
      confirmationToken,
      null,
    );
  }

  unsubscribe(unsubscribeTokenValue: string, now: Date) {
    if (
      this.unsubscribeToken === null ||
      this.unsubscribeToken.value !== unsubscribeTokenValue
    ) {
      throw new WrongTokenScopeError('unsubscribe', 'unknown');
    }

    if (this.status !== 'confirmed') {
      throw new IllegalStateTransitionError(this.status, 'unsubscribed');
    }

    this.unsubscribeToken = this.unsubscribeToken.consume(now);
    this._status = 'unsubscribed';
  }

  confirm(tokenValue: string, now: Date, unsubscribeToken: ConfirmationToken) {
    if (this.confirmationToken.value !== tokenValue) {
      throw new WrongTokenScopeError('subscribe', 'unknown');
    }

    if (this.status !== 'pending') {
      throw new IllegalStateTransitionError(this.status, 'confirmed');
    }

    if (unsubscribeToken.scope !== 'unsubscribe') {
      throw new WrongTokenScopeError('unsubscribe', unsubscribeToken.scope);
    }

    this.confirmationToken = this.confirmationToken.consume(now);
    this.unsubscribeToken = unsubscribeToken;
    this._status = 'confirmed';
  }

  observeRelease(tag: ReleaseTag) {
    if (this.status !== 'confirmed') return;
    if (this.lastSeenTag && this.lastSeenTag.equals(tag)) return;

    this._lastSeenTag = tag;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }
  get lastSeenTag(): ReleaseTag | null {
    return this._lastSeenTag;
  }
}
