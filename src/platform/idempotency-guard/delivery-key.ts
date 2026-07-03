export const deliveryKey = (messageId: string, consumer: string): string =>
  `${messageId}:${consumer}`;
