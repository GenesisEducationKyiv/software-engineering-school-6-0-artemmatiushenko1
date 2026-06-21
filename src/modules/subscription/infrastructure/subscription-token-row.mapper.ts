import { z } from 'zod';
import {
  ConfirmationToken,
  ConfirmationTokenScopeSchema,
} from '../domain/confirmation-token.js';

export const SubscriptionTokenRowSchema = z.object({
  id: z.number().int(),
  token: z.string(),
  subscriptionId: z.string(),
  scope: ConfirmationTokenScopeSchema,
  expiresAt: z.date(),
  usedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type SubscriptionTokenRow = z.infer<typeof SubscriptionTokenRowSchema>;

export class SubscriptionTokenRowMapper {
  toDomain(row: SubscriptionTokenRow): ConfirmationToken {
    return ConfirmationToken.hydrate({
      value: row.token,
      scope: row.scope,
      expiresAt: row.expiresAt,
      consumedAt: row.usedAt,
    });
  }

  toRow(
    token: ConfirmationToken,
    subscriptionId: string,
    createdAt: Date,
  ): SubscriptionTokenRow {
    return {
      // TODO: remove id field, potentially inline it into subscriptions table
      id: 0,
      token: token.value,
      subscriptionId,
      scope: token.scope,
      expiresAt: token.expiresAt,
      usedAt: token.consumedAt,
      createdAt,
    };
  }
}
