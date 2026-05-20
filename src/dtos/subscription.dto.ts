import { z } from 'zod';
import type { Subscription } from '../domain/subscription.js';

export const SubscriptionResponseDtoSchema = z.object({
  email: z.email(),
  repo: z.string(),
  confirmed: z.boolean(),
  last_seen_tag: z.string().nullable(),
});

export type SubscriptionResponseDto = z.infer<
  typeof SubscriptionResponseDtoSchema
>;

export function toSubscriptionResponseDto(
  subscription: Subscription,
): SubscriptionResponseDto {
  return SubscriptionResponseDtoSchema.parse({
    email: subscription.email,
    repo: subscription.repo,
    confirmed: subscription.confirmed,
    last_seen_tag: subscription.lastSeenTag,
  });
}
