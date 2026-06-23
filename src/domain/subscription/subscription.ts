import type { ConfirmationToken } from './confirmation-token.js';
import { ConfirmationTokenScope } from './confirmation-token-scope.js';
import type { Email } from './email.js';
import {
  IllegalStateTransitionError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
  WrongTokenScopeError,
} from './errors.js';
import type { ReleaseTag } from './release-tag.js';
import type { RepoPath } from './repo-path.js';
import { SubscriptionStatus } from './subscription-status.js';

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
    if (
      params.status === SubscriptionStatus.Confirmed &&
      !params.unsubscribeToken
    ) {
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
    if (confirmationToken.scope !== ConfirmationTokenScope.Subscribe) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Subscribe,
        confirmationToken.scope,
      );
    }

    return new Subscription(
      id,
      email,
      repoPath,
      SubscriptionStatus.Pending,
      null,
      confirmationToken,
      null,
    );
  }

  unsubscribe(unsubscribeTokenValue: string, now: Date) {
    const token = this._unsubscribeToken;
    if (token === null || token.value !== unsubscribeTokenValue) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Unsubscribe,
        'unknown',
      );
    }

    if (this.status !== SubscriptionStatus.Confirmed) {
      throw new IllegalStateTransitionError(
        this.status,
        SubscriptionStatus.Unsubscribed,
      );
    }

    this._unsubscribeToken = token.consume(now);
    this._status = SubscriptionStatus.Unsubscribed;
  }

  confirm(token: string, now: Date, unsubscribeToken: ConfirmationToken) {
    if (this.confirmationToken.value !== token) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Subscribe,
        'unknown',
      );
    }

    if (this.status !== SubscriptionStatus.Pending) {
      throw new SubscriptionAlreadyConfirmedError();
    }

    if (unsubscribeToken.scope !== ConfirmationTokenScope.Unsubscribe) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Unsubscribe,
        unsubscribeToken.scope,
      );
    }

    this._confirmationToken = this._confirmationToken.consume(now);
    this._unsubscribeToken = unsubscribeToken;
    this._status = SubscriptionStatus.Confirmed;
  }

  observeRelease(tag: ReleaseTag) {
    if (this.status !== SubscriptionStatus.Confirmed) return;
    if (this.lastSeenTag && this.lastSeenTag.equals(tag)) return;

    this._lastSeenTag = tag;
  }

  renewConfirmation(newToken: ConfirmationToken): void {
    if (newToken.scope !== ConfirmationTokenScope.Subscribe) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Subscribe,
        newToken.scope,
      );
    }

    if (this._status === SubscriptionStatus.Confirmed) {
      throw new SubscriptionAlreadyConfirmedError();
    }

    if (this._status === SubscriptionStatus.Unsubscribed) {
      throw new SubscriptionAlreadyDeactivatedError();
    }

    this._confirmationToken = newToken;
  }

  reactivate(newToken: ConfirmationToken): void {
    if (newToken.scope !== ConfirmationTokenScope.Subscribe) {
      throw new WrongTokenScopeError(
        ConfirmationTokenScope.Subscribe,
        newToken.scope,
      );
    }

    if (this._status === SubscriptionStatus.Confirmed) {
      throw new SubscriptionAlreadyConfirmedError();
    }

    if (this._status !== SubscriptionStatus.Unsubscribed) {
      throw new IllegalStateTransitionError(
        this._status,
        SubscriptionStatus.Pending,
      );
    }

    this._confirmationToken = newToken;
    this._unsubscribeToken = null;
    this._status = SubscriptionStatus.Pending;
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
