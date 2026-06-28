import { z } from 'zod';
import {
  Subscription,
  Email,
  RepoPath,
  SubscriptionToken,
  ReleaseTag,
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../domain/subscription/index.js';

export const SubscriptionRowSchema = z.object({
  id: z.string(),
  email: z.email(),
  repo: z.string(),
  status: z.enum(SubscriptionStatus),
  lastSeenTag: z.string().nullable(),
  confirmToken: z.string(),
  confirmExpiresAt: z.date(),
  confirmUsedAt: z.date().nullable(),
  unsubscribeToken: z.string().nullable(),
  unsubscribeUsedAt: z.date().nullable(),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

export class SubscriptionRowMapper {
  toDomain(row: SubscriptionRow): Subscription {
    const email = Email.fromString(row.email);
    const repoPath = RepoPath.fromString(row.repo);
    const lastSeenTag = row.lastSeenTag
      ? ReleaseTag.fromString(row.lastSeenTag)
      : null;

    const subscriptionToken = SubscriptionToken.rehydrate({
      value: row.confirmToken,
      scope: SubscriptionTokenScope.Confirm,
      expiresAt: row.confirmExpiresAt,
      consumedAt: row.confirmUsedAt,
    });

    const unsubscribeToken = row.unsubscribeToken
      ? SubscriptionToken.rehydrate({
          value: row.unsubscribeToken,
          scope: SubscriptionTokenScope.Unsubscribe,
          expiresAt: null,
          consumedAt: row.unsubscribeUsedAt,
        })
      : null;

    return Subscription.rehydrate({
      id: row.id,
      email,
      repoPath,
      status: row.status,
      lastSeenTag,
      confirmationToken: subscriptionToken,
      unsubscribeToken,
    });
  }

  toRow(subscription: Subscription): SubscriptionRow {
    const subscriptionToken = subscription.confirmationToken;
    const unsubscribe = subscription.unsubscribeToken;

    if (!subscriptionToken.expiresAt) {
      throw new Error('Confirm token expires at is required');
    }

    return {
      id: subscription.id,
      email: subscription.email.value,
      repo: subscription.repoPath.toString(),
      status: subscription.status,
      lastSeenTag: subscription.lastSeenTag?.value ?? null,
      confirmToken: subscriptionToken.value,
      confirmExpiresAt: subscriptionToken.expiresAt,
      confirmUsedAt: subscriptionToken.consumedAt,
      unsubscribeToken: unsubscribe?.value ?? null,
      unsubscribeUsedAt: unsubscribe?.consumedAt ?? null,
    };
  }
}
