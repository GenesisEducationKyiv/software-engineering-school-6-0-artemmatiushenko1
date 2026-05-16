import { z } from 'zod';

export const SubscriptionsResponseDtoSchema = z.array(
  z.object({
    email: z.email(),
    repo: z.string(),
    confirmed: z.boolean(),
    last_seen_tag: z.string().nullish(),
  }),
);

export type SubscriptionsResponseDto = z.infer<
  typeof SubscriptionsResponseDtoSchema
>;
