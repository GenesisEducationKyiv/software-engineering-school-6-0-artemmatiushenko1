import { z } from 'zod';

export const SubscriptionsResponseDtoSchema = z.array(
  z.object({
    email: z.email(),
    repo: z.string(),
    confirmed: z.boolean(),
    lastSeenTag: z.string().nullable(),
  }),
);

export type SubscriptionsResponseDto = z.infer<
  typeof SubscriptionsResponseDtoSchema
>;
