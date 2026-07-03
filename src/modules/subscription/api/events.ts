import type {
  IntegrationEvent,
  DeliveredEvent,
} from '../../../platform/event-bus/domain-event-envelope.js';

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

export type SubscriptionRequestedIntegrationEvent = IntegrationEvent<
  SubscriptionRequestedPayload,
  typeof SubscriptionEventType.Requested
>;
export type SubscriptionRequestedEvent = DeliveredEvent<
  SubscriptionRequestedPayload,
  typeof SubscriptionEventType.Requested
>;

type SubscriptionConfirmationRenewedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionConfirmationRenewedIntegrationEvent = IntegrationEvent<
  SubscriptionConfirmationRenewedPayload,
  typeof SubscriptionEventType.ConfirmationRenewed
>;
export type SubscriptionConfirmationRenewedEvent = DeliveredEvent<
  SubscriptionConfirmationRenewedPayload,
  typeof SubscriptionEventType.ConfirmationRenewed
>;

type SubscriptionReactivatedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionReactivatedIntegrationEvent = IntegrationEvent<
  SubscriptionReactivatedPayload,
  typeof SubscriptionEventType.Reactivated
>;
export type SubscriptionReactivatedEvent = DeliveredEvent<
  SubscriptionReactivatedPayload,
  typeof SubscriptionEventType.Reactivated
>;

type SubscriptionConfirmedPayload = {
  email: string;
  repo: string;
  unsubscribeToken: string;
};

export type SubscriptionConfirmedIntegrationEvent = IntegrationEvent<
  SubscriptionConfirmedPayload,
  typeof SubscriptionEventType.Confirmed
>;
export type SubscriptionConfirmedEvent = DeliveredEvent<
  SubscriptionConfirmedPayload,
  typeof SubscriptionEventType.Confirmed
>;

type SubscriptionDeactivatedPayload = {
  repo: string;
};

export type SubscriptionDeactivatedIntegrationEvent = IntegrationEvent<
  SubscriptionDeactivatedPayload,
  typeof SubscriptionEventType.Deactivated
>;
export type SubscriptionDeactivatedEvent = DeliveredEvent<
  SubscriptionDeactivatedPayload,
  typeof SubscriptionEventType.Deactivated
>;

type SubscriptionRenewedPayload = {
  repo: string;
};

export type SubscriptionRenewedIntegrationEvent = IntegrationEvent<
  SubscriptionRenewedPayload,
  typeof SubscriptionEventType.Renewed
>;
export type SubscriptionRenewedEvent = DeliveredEvent<
  SubscriptionRenewedPayload,
  typeof SubscriptionEventType.Renewed
>;

export type SubscriptionPublicApiEvent =
  | SubscriptionRequestedIntegrationEvent
  | SubscriptionConfirmationRenewedIntegrationEvent
  | SubscriptionReactivatedIntegrationEvent
  | SubscriptionConfirmedIntegrationEvent
  | SubscriptionDeactivatedIntegrationEvent
  | SubscriptionRenewedIntegrationEvent;
