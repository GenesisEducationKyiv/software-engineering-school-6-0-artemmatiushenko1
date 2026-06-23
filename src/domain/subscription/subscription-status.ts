import z from 'zod';

export const SubscriptionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'unsubscribed',
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
