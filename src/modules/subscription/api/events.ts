import type { DomainEventEnvelope } from '../../../platform/event-bus/domain-event-envelope.js';

export const SubscriptionEventType = {
  Requested: 'SubscriptionRequested',
  Confirmed: 'SubscriptionConfirmed',
  Deactivated: 'SubscriptionDeactivated',
  Renewed: 'SubscriptionRenewed',
} as const;

export type SubscriptionRequestedPayload = {
  email: string;
  repo: string;
  confirmationToken: string;
};

export type SubscriptionRequestedEvent =
  DomainEventEnvelope<SubscriptionRequestedPayload> & {
    type: typeof SubscriptionEventType.Requested;
  };

export type SubscriptionConfirmedPayload = {
  repo: string;
};

export type SubscriptionConfirmedEvent =
  DomainEventEnvelope<SubscriptionConfirmedPayload> & {
    type: typeof SubscriptionEventType.Confirmed;
  };

export type SubscriptionDeactivatedPayload = {
  repo: string;
};

export type SubscriptionDeactivatedEvent =
  DomainEventEnvelope<SubscriptionDeactivatedPayload> & {
    type: typeof SubscriptionEventType.Deactivated;
  };

export type SubscriptionRenewedPayload = {
  repo: string;
};

export type SubscriptionRenewedEvent =
  DomainEventEnvelope<SubscriptionRenewedPayload> & {
    type: typeof SubscriptionEventType.Renewed;
  };

export type SubscriptionPublicApiEvent =
  | SubscriptionRequestedEvent
  | SubscriptionConfirmedEvent
  | SubscriptionDeactivatedEvent
  | SubscriptionRenewedEvent;
