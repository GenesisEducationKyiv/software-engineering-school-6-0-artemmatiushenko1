import type { IntegrationEvent } from '../../../platform/event-bus/domain-event-envelope.js';

export const SubscriptionEventType = {
  Requested: 'SubscriptionRequested',
  ConfirmationRenewed: 'SubscriptionConfirmationRenewed',
  Reactivated: 'SubscriptionReactivated',
  Confirmed: 'SubscriptionConfirmed',
  Deactivated: 'SubscriptionDeactivated',
  Renewed: 'SubscriptionRenewed',
} as const;

type SubscriptionRequestedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionRequestedEvent = IntegrationEvent<
  SubscriptionRequestedPayload,
  typeof SubscriptionEventType.Requested
>;

type SubscriptionConfirmationRenewedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionConfirmationRenewedEvent = IntegrationEvent<
  SubscriptionConfirmationRenewedPayload,
  typeof SubscriptionEventType.ConfirmationRenewed
>;

type SubscriptionReactivatedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionReactivatedEvent = IntegrationEvent<
  SubscriptionReactivatedPayload,
  typeof SubscriptionEventType.Reactivated
>;

type SubscriptionConfirmedPayload = {
  email: string;
  repo: string;
  unsubscribeToken: string;
};

export type SubscriptionConfirmedEvent = IntegrationEvent<
  SubscriptionConfirmedPayload,
  typeof SubscriptionEventType.Confirmed
>;

type SubscriptionDeactivatedPayload = {
  repo: string;
};

export type SubscriptionDeactivatedEvent = IntegrationEvent<
  SubscriptionDeactivatedPayload,
  typeof SubscriptionEventType.Deactivated
>;

type SubscriptionRenewedPayload = {
  repo: string;
};

export type SubscriptionRenewedEvent = IntegrationEvent<
  SubscriptionRenewedPayload,
  typeof SubscriptionEventType.Renewed
>;

export type SubscriptionPublicApiEvent =
  | SubscriptionRequestedEvent
  | SubscriptionConfirmationRenewedEvent
  | SubscriptionReactivatedEvent
  | SubscriptionConfirmedEvent
  | SubscriptionDeactivatedEvent
  | SubscriptionRenewedEvent;
