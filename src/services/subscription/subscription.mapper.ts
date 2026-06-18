import type {
  Subscription as SubscriptionRow,
  SubscriptionToken as SubscriptionTokenRow,
} from '../../domain/subscription.js';
import { Subscription } from '../../domain/subscription/subscription.js';
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';
import { ReleaseTag } from '../../domain/subscription/release-tag.js';

export type SubscriptionMapperTokens = {
  subscribe?: SubscriptionTokenRow;
  unsubscribe?: SubscriptionTokenRow | null;
};

export class SubscriptionMapper {
  toDomain(
    row: SubscriptionRow,
    tokens: SubscriptionMapperTokens = {},
  ): Subscription {
    const subscribe = tokens.subscribe;
    const unsubscribe = tokens.unsubscribe ?? null;

    if (!subscribe && !unsubscribe) {
      throw new Error(
        'At least one token is required to hydrate a subscription',
      );
    }

    const confirmationToken = subscribe
      ? this.toDomainToken(subscribe)
      : ConfirmationToken.hydrate({
          value: unsubscribe!.token,
          scope: 'subscribe',
          expiresAt: unsubscribe!.expiresAt,
        });

    const unsubscribeToken =
      !subscribe && unsubscribe ? this.toDomainToken(unsubscribe) : null;

    const status =
      !subscribe && unsubscribe
        ? 'confirmed'
        : row.confirmed
          ? 'confirmed'
          : 'pending';

    return Subscription.hydrate({
      id: String(row.id),
      email: Email.fromString(row.email),
      repoPath: RepoPath.fromString(row.repo),
      status,
      lastSeenTag: row.lastSeenTag
        ? ReleaseTag.fromString(row.lastSeenTag)
        : null,
      confirmationToken,
      unsubscribeToken,
    });
  }

  toRow(subscription: Subscription, createdAt: Date): SubscriptionRow {
    return {
      id: Number(subscription.id),
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      confirmed: subscription.status === 'confirmed',
      lastSeenTag: subscription.lastSeenTag?.value ?? null,
      createdAt,
    };
  }

  toDomainToken(row: SubscriptionTokenRow): ConfirmationToken {
    return ConfirmationToken.hydrate({
      value: row.token,
      scope: row.scope,
      expiresAt: row.expiresAt,
    });
  }

  toRowToken(
    token: ConfirmationToken,
    subscriptionId: number,
    createdAt: Date,
  ): SubscriptionTokenRow {
    return {
      id: 0,
      token: token.value,
      subscriptionId,
      scope: token.scope,
      expiresAt: token.expiresAt,
      createdAt,
    };
  }
}
