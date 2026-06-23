import z from 'zod';

export const ConfirmationTokenScopeSchema = z.enum(
  ['subscribe', 'unsubscribe'],
  {
    message: "Invalid scope. Expected 'subscribe' or 'unsubscribe'.",
  },
);

export type ConfirmationTokenScope = z.infer<
  typeof ConfirmationTokenScopeSchema
>;
