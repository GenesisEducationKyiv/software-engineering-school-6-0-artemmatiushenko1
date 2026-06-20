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
    private _confirmationToken: ConfirmationToken,
    private _unsubscribeToken: ConfirmationToken | null,
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
    if (params.status === 'confirmed' && !params.unsubscribeToken) {
      throw new Error(
        'Unsubscribe token is required for confirmed subscriptions',
      );
    }

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
    const token = this._unsubscribeToken;
    if (token === null || token.value !== unsubscribeTokenValue) {
      throw new WrongTokenScopeError('unsubscribe', 'unknown');
    }

    if (this.status !== 'confirmed') {
      throw new IllegalStateTransitionError(this.status, 'unsubscribed');
    }

    this._unsubscribeToken = token.consume(now);
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

    this._confirmationToken = this._confirmationToken.consume(now);
    this._unsubscribeToken = unsubscribeToken;
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
  get confirmationToken(): ConfirmationToken {
    return this._confirmationToken;
  }
  get unsubscribeToken(): ConfirmationToken | null {
    return this._unsubscribeToken;
  }
}
