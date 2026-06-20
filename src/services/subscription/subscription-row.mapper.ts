import { z } from 'zod';
import { Subscription } from '../../domain/subscription/subscription.js';
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';
import { ReleaseTag } from '../../domain/subscription/release-tag.js';
import {
  SubscriptionTokenRowMapper,
  type SubscriptionTokenRow,
} from './subscription-token-row.mapper.js';

export const SubscriptionRowSchema = z.object({
  id: z.number().int(),
  email: z.email(),
  repo: z.string(),
  confirmed: z.boolean(),
  lastSeenTag: z.string().nullable(),
  createdAt: z.date(),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

export type SubscriptionMapperTokens = {
  subscribe?: SubscriptionTokenRow;
  unsubscribe?: SubscriptionTokenRow | null;
};

export class SubscriptionRowMapper {
  readonly tokenMapper = new SubscriptionTokenRowMapper();

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
      ? this.tokenMapper.toDomain(subscribe)
      : ConfirmationToken.hydrate({
          value: unsubscribe!.token,
          scope: 'subscribe',
          expiresAt: unsubscribe!.expiresAt,
        });

    const unsubscribeToken =
      !subscribe && unsubscribe ? this.tokenMapper.toDomain(unsubscribe) : null;

    const status =
      !subscribe && unsubscribe
        ? 'confirmed'
        : row.confirmed
          ? 'confirmed'
          : 'pending';

    const email = Email.fromString(row.email);
    const repoPath = RepoPath.fromString(row.repo);
    const lastSeenTag = row.lastSeenTag
      ? ReleaseTag.fromString(row.lastSeenTag)
      : null;

    return Subscription.rehydrate({
      id: String(row.id),
      email,
      repoPath,
      status,
      lastSeenTag,
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
}
