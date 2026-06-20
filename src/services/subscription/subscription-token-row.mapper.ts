import { z } from 'zod';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';

export const SubscriptionTokenScopeSchema = z.enum([
  'subscribe',
  'unsubscribe',
]);
export type SubscriptionTokenScope = z.infer<
  typeof SubscriptionTokenScopeSchema
>;

export const SubscriptionTokenRowSchema = z.object({
  id: z.number().int(),
  token: z.string(),
  subscriptionId: z.string(),
  scope: SubscriptionTokenScopeSchema,
  expiresAt: z.date(),
  createdAt: z.date(),
});

export type SubscriptionTokenRow = z.infer<typeof SubscriptionTokenRowSchema>;

export class SubscriptionTokenRowMapper {
  toDomain(row: SubscriptionTokenRow): ConfirmationToken {
    return ConfirmationToken.hydrate({
      value: row.token,
      scope: row.scope,
      expiresAt: row.expiresAt,
    });
  }

  toRow(
    token: ConfirmationToken,
    subscriptionId: string,
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
