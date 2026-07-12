import { z } from 'zod';
import { Email, Recipient } from '../domain/index.js';

export const RecipientRowSchema = z.object({
  subscriptionId: z.string(),
  email: z.string(),
  unsubscribeToken: z.string(),
});

export type RecipientRow = z.infer<typeof RecipientRowSchema>;

export class RecipientRowMapper {
  toDomain(row: RecipientRow): Recipient {
    return Recipient.rehydrate({
      subscriptionId: row.subscriptionId,
      email: Email.fromString(row.email),
      unsubscribeToken: row.unsubscribeToken,
    });
  }

  toRow(recipient: Recipient): RecipientRow {
    return {
      subscriptionId: recipient.subscriptionId,
      email: recipient.email.value,
      unsubscribeToken: recipient.unsubscribeToken,
    };
  }
}
