import { z } from 'zod';
import {
  Subscription,
  SubscriptionStatusSchema,
} from '../domain/subscription.js';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import { ConfirmationToken } from '../domain/confirmation-token.js';
import { ReleaseTag } from '../domain/release-tag.js';

export const SubscriptionRowSchema = z.object({
  id: z.string(),
  email: z.email(),
  repo: z.string(),
  status: SubscriptionStatusSchema,
  lastSeenTag: z.string().nullable(),
  createdAt: z.date(),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

export class SubscriptionRowMapper {
  toDomain(
    row: SubscriptionRow,
    confirmationToken: ConfirmationToken,
    unsubscribeToken: ConfirmationToken | null,
  ): Subscription {
    const email = Email.fromString(row.email);
    const repoPath = RepoPath.fromString(row.repo);
    const lastSeenTag = row.lastSeenTag
      ? ReleaseTag.fromString(row.lastSeenTag)
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

  toRow(subscription: Subscription, createdAt: Date): SubscriptionRow {
    return {
      id: subscription.id,
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      status: subscription.status,
      lastSeenTag: subscription.lastSeenTag?.value ?? null,
      createdAt,
    };
  }
}
