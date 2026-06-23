import { z } from 'zod';
import {
  Subscription,
  SubscriptionStatusSchema,
} from '../domain/subscription/subscription.js';
import { Email } from '../domain/subscription/email.js';
import { RepoPath } from '../domain/subscription/repo-path.js';
import { ConfirmationToken } from '../domain/subscription/confirmation-token.js';
import { ReleaseTag } from '../domain/subscription/release-tag.js';

export const SubscriptionRowSchema = z.object({
  id: z.string(),
  email: z.email(),
  repo: z.string(),
  status: SubscriptionStatusSchema,
  lastSeenTag: z.string().nullable(),
  confirmToken: z.string(),
  confirmExpiresAt: z.date(),
  confirmUsedAt: z.date().nullable(),
  unsubscribeToken: z.string().nullable(),
  unsubscribeExpiresAt: z.date().nullable(),
  unsubscribeUsedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

export class SubscriptionRowMapper {
  toDomain(row: SubscriptionRow): Subscription {
    const email = Email.fromString(row.email);
    const repoPath = RepoPath.fromString(row.repo);
    const lastSeenTag = row.lastSeenTag
      ? ReleaseTag.fromString(row.lastSeenTag)
      : null;

    const confirmationToken = ConfirmationToken.hydrate({
      value: row.confirmToken,
      scope: 'subscribe',
      expiresAt: row.confirmExpiresAt,
      consumedAt: row.confirmUsedAt,
    });

    const unsubscribeToken =
      row.unsubscribeToken && row.unsubscribeExpiresAt
        ? ConfirmationToken.hydrate({
            value: row.unsubscribeToken,
            scope: 'unsubscribe',
            expiresAt: row.unsubscribeExpiresAt,
            consumedAt: row.unsubscribeUsedAt,
          })
        : null;

    return Subscription.rehydrate({
      id: row.id,
      email,
      repoPath,
      status: row.status,
      lastSeenTag,
      confirmationToken,
      unsubscribeToken,
    });
  }

  toRow(subscription: Subscription) {
    const confirmation = subscription.confirmationToken;
    const unsubscribe = subscription.unsubscribeToken;

    return {
      id: subscription.id,
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      status: subscription.status,
      lastSeenTag: subscription.lastSeenTag?.value ?? null,
      confirmToken: confirmation.value,
      confirmExpiresAt: confirmation.expiresAt,
      confirmUsedAt: confirmation.consumedAt,
      unsubscribeToken: unsubscribe?.value ?? null,
      unsubscribeExpiresAt: unsubscribe?.expiresAt ?? null,
      unsubscribeUsedAt: unsubscribe?.consumedAt ?? null,
    };
  }
}
