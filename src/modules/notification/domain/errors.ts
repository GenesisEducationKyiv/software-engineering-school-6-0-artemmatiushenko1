export class RecipientNotFoundError extends Error {
  readonly code = 'RECIPIENT_NOT_FOUND' as const;

  constructor(subscriptionId: string) {
    super(`Notification recipient not found: ${subscriptionId}`);
    this.name = 'RecipientNotFoundError';
  }
}
