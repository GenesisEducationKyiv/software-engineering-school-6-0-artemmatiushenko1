import { z } from 'zod';

export const SubscriptionsResponseDtoSchema = z.array(
  z.object({
    email: z.email(),
    repo: z.string(),
    confirmed: z.boolean(),
  }),
);

export type SubscriptionsResponseDto = z.infer<
  typeof SubscriptionsResponseDtoSchema
>;
