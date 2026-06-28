import type { SubscriptionToken } from './subscription-token.js';
import { SubscriptionTokenScope } from './subscription-token-scope.js';
import type {
  Email,
  ReleaseTag,
  RepoPath,
} from '../../../shared-kernel/index.js';
import {
  IllegalStateTransitionError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
  WrongTokenScopeError,
} from './errors.js';
import { SubscriptionStatus } from './subscription-status.js';
import type { DomainEvent } from '../../../shared-kernel/domain-event.js';
import {
  SubscriptionConfirmationRenewedEvent,
  SubscriptionConfirmedEvent,
  SubscriptionReactivatedEvent,
  SubscriptionRequestedEvent,
} from './events.js';

export class Subscription {
  private readonly events: DomainEvent[] = [];

  private constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly repoPath: RepoPath,
    private _status: SubscriptionStatus,
    private _lastSeenTag: ReleaseTag | null,
    private _confirmationToken: SubscriptionToken,
    private _unsubscribeToken: SubscriptionToken | null,
  ) {}

  static rehydrate(params: {
    id: string;
    email: Email;
    repoPath: RepoPath;
    status: SubscriptionStatus;
    lastSeenTag: ReleaseTag | null;
    confirmationToken: SubscriptionToken;
    unsubscribeToken: SubscriptionToken | null;
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
    confirmationToken: SubscriptionToken,
    now: Date,
  ): Subscription {
    if (confirmationToken.scope !== SubscriptionTokenScope.Confirm) {
      throw new WrongTokenScopeError(
        SubscriptionTokenScope.Confirm,
        confirmationToken.scope,
      );
    }

    const subscription = new Subscription(
      id,
      email,
      repoPath,
      SubscriptionStatus.Pending,
      null,
      confirmationToken,
      null,
    );

    subscription.events.push(
      new SubscriptionRequestedEvent(
        subscription.id,
        {
          repoPath: subscription.repoPath,
          email: subscription.email,
          confirmationToken: subscription.confirmationToken,
        },
        now,
      ),
    );

    return subscription;
  }

  unsubscribe(unsubscribeTokenValue: string, now: Date) {
    const token = this._unsubscribeToken;
    if (token === null || token.value !== unsubscribeTokenValue) {
      throw new WrongTokenScopeError(
        SubscriptionTokenScope.Unsubscribe,
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

  confirm(
    token: string,
    now: Date,
    unsubscribeToken: SubscriptionToken,
    baselineTag: ReleaseTag | null,
  ) {
    if (this.confirmationToken.value !== token) {
      throw new WrongTokenScopeError(SubscriptionTokenScope.Confirm, 'unknown');
    }

    if (this.status !== SubscriptionStatus.Pending) {
      throw new SubscriptionAlreadyConfirmedError();
    }

    if (unsubscribeToken.scope !== SubscriptionTokenScope.Unsubscribe) {
      throw new WrongTokenScopeError(
        SubscriptionTokenScope.Unsubscribe,
        unsubscribeToken.scope,
      );
    }

    this._confirmationToken = this._confirmationToken.consume(now);
    this._unsubscribeToken = unsubscribeToken;
    this._status = SubscriptionStatus.Confirmed;
    this._lastSeenTag = baselineTag;

    this.events.push(
      new SubscriptionConfirmedEvent(
        this.id,
        {
          repoPath: this.repoPath,
          email: this.email,
          unsubscribeToken: this._unsubscribeToken,
          baselineTag,
        },
        now,
      ),
    );
  }

  observeRelease(tag: ReleaseTag) {
    if (this.status !== SubscriptionStatus.Confirmed) return;
    if (this.lastSeenTag && this.lastSeenTag.equals(tag)) return;

    this._lastSeenTag = tag;
  }

  renewConfirmation(newToken: SubscriptionToken, now: Date): void {
    if (newToken.scope !== SubscriptionTokenScope.Confirm) {
      throw new WrongTokenScopeError(
        SubscriptionTokenScope.Confirm,
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

    this.events.push(
      new SubscriptionConfirmationRenewedEvent(
        this.id,
        {
          repoPath: this.repoPath,
          email: this.email,
          confirmationToken: this._confirmationToken,
        },
        now,
      ),
    );
  }

  reactivate(newConfirmationToken: SubscriptionToken, now: Date): void {
    if (newConfirmationToken.scope !== SubscriptionTokenScope.Confirm) {
      throw new WrongTokenScopeError(
        SubscriptionTokenScope.Confirm,
        newConfirmationToken.scope,
      );
    }

    if (this._status !== SubscriptionStatus.Unsubscribed) {
      throw new IllegalStateTransitionError(
        this._status,
        SubscriptionStatus.Pending,
      );
    }

    this._confirmationToken = newConfirmationToken;
    this._unsubscribeToken = null;
    this._status = SubscriptionStatus.Pending;

    this.events.push(
      new SubscriptionReactivatedEvent(
        this.id,
        {
          repoPath: this.repoPath,
          email: this.email,
          confirmationToken: this._confirmationToken,
        },
        now,
      ),
    );
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get lastSeenTag(): ReleaseTag | null {
    return this._lastSeenTag;
  }

  get confirmationToken(): SubscriptionToken {
    return this._confirmationToken;
  }

  get unsubscribeToken(): SubscriptionToken | null {
    return this._unsubscribeToken;
  }

  pullEvents(): DomainEvent[] {
    const copy = [...this.events];
    this.events.length = 0;
    return copy;
  }
}
