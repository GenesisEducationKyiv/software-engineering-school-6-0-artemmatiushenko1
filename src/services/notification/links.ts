export const buildConfirmUrl = (appUrl: string, token: string): string =>
  `${appUrl}/confirm/${token}`;

export const buildUnsubscribeUrl = (appUrl: string, token: string): string =>
  `${appUrl}/unsubscribe/${token}`;
