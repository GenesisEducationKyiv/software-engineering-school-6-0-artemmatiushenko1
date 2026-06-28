import type { DomainEventEnvelope } from '../../../platform/event-bus/domain-event-envelope.js';

export const SubscriptionEventType = {
  Requested: 'SubscriptionRequested',
  ConfirmationRenewed: 'SubscriptionConfirmationRenewed',
  Reactivated: 'SubscriptionReactivated',
  Confirmed: 'SubscriptionConfirmed',
  Deactivated: 'SubscriptionDeactivated',
  Renewed: 'SubscriptionRenewed',
} as const;

export type SubscriptionRequestedEvent = DomainEventEnvelope<
  {
    email: string;
    repo: string;
    confirmationToken: string;
  },
  typeof SubscriptionEventType.Requested
>;

export type SubscriptionConfirmationRenewedEvent = DomainEventEnvelope<
  {
    email: string;
    repo: string;
    confirmationToken: string;
  },
  typeof SubscriptionEventType.ConfirmationRenewed
>;

export type SubscriptionReactivatedEvent = DomainEventEnvelope<
  {
    email: string;
    repo: string;
    confirmationToken: string;
  },
  typeof SubscriptionEventType.Reactivated
>;

export type SubscriptionConfirmedEvent = DomainEventEnvelope<
  {
    email: string;
    repo: string;
    unsubscribeToken: string;
    baselineTag: string | null;
  },
  typeof SubscriptionEventType.Confirmed
>;

export type SubscriptionDeactivatedEvent = DomainEventEnvelope<
  {
    repo: string;
  },
  typeof SubscriptionEventType.Deactivated
>;

export type SubscriptionRenewedEvent = DomainEventEnvelope<
  {
    repo: string;
  },
  typeof SubscriptionEventType.Renewed
>;

export type SubscriptionPublicApiEvent =
  | SubscriptionRequestedEvent
  | SubscriptionConfirmationRenewedEvent
  | SubscriptionReactivatedEvent
  | SubscriptionConfirmedEvent
  | SubscriptionDeactivatedEvent
  | SubscriptionRenewedEvent;
