import { z } from 'zod';
import {
  Subscription,
  Email,
  RepoPath,
  SubscriptionToken,
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../domain/index.js';

export const SubscriptionRowSchema = z.object({
  id: z.string(),
  email: z.email(),
  repo: z.string(),
  status: z.enum(SubscriptionStatus),
  confirmToken: z.string(),
  confirmExpiresAt: z.date(),
  confirmUsedAt: z.date().nullable(),
  unsubscribeToken: z.string().nullable(),
  unsubscribeExpiresAt: z.date().nullable(),
  unsubscribeUsedAt: z.date().nullable(),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

export class SubscriptionRowMapper {
  toDomain(row: SubscriptionRow): Subscription {
    const email = Email.fromString(row.email);
    const repoPath = RepoPath.fromString(row.repo);
    const subscriptionToken = SubscriptionToken.rehydrate({
      value: row.confirmToken,
      scope: SubscriptionTokenScope.Confirm,
      expiresAt: row.confirmExpiresAt,
      consumedAt: row.confirmUsedAt,
    });

    const unsubscribeToken =
      row.unsubscribeToken && row.unsubscribeExpiresAt
        ? SubscriptionToken.rehydrate({
            value: row.unsubscribeToken,
            scope: SubscriptionTokenScope.Unsubscribe,
            expiresAt: row.unsubscribeExpiresAt,
            consumedAt: row.unsubscribeUsedAt,
          })
        : null;

    return Subscription.rehydrate({
      id: row.id,
      email,
      repoPath,
      status: row.status,
      confirmationToken: subscriptionToken,
      unsubscribeToken,
    });
  }

  toRow(subscription: Subscription): SubscriptionRow {
    const subscriptionToken = subscription.confirmationToken;
    const unsubscribe = subscription.unsubscribeToken;

    return {
      id: subscription.id,
      email: subscription.email.value,
      repo: subscription.repoPath.toString(),
      status: subscription.status,
      confirmToken: subscriptionToken.value,
      confirmExpiresAt: subscriptionToken.expiresAt,
      confirmUsedAt: subscriptionToken.consumedAt,
      unsubscribeToken: unsubscribe?.value ?? null,
      unsubscribeExpiresAt: unsubscribe?.expiresAt ?? null,
      unsubscribeUsedAt: unsubscribe?.consumedAt ?? null,
    };
  }
}
