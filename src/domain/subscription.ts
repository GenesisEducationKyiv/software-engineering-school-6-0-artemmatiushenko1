import { z } from 'zod';

export const RepoPathSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/, {
    message: "Invalid repository format. Expected 'owner/repo'",
  });

export const SubscriptionSchema = z.object({
  id: z.number().int(),
  email: z.email(),
  repo: z.string(),
  confirmed: z.boolean(),
  lastSeenTag: z.string().nullable(),
  createdAt: z.date(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionTokenScopeSchema = z.enum([
  'subscribe',
  'unsubscribe',
]);
export type SubscriptionTokenScope = z.infer<
  typeof SubscriptionTokenScopeSchema
>;

export const SubscriptionTokenSchema = z.object({
  id: z.number().int(),
  token: z.string(),
  subscriptionId: z.number().int(),
  scope: SubscriptionTokenScopeSchema,
  expiresAt: z.date(),
  createdAt: z.date(),
});

export type SubscriptionToken = z.infer<typeof SubscriptionTokenSchema>;
