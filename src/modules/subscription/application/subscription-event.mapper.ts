import type { DomainEvent } from '../../../shared-kernel/domain-event.js';
import {
  SubscriptionEventType,
  type SubscriptionPublicApiEvent,
} from '../api/events.js';
import {
  SubscriptionConfirmationRenewedEvent,
  SubscriptionConfirmedEvent,
  SubscriptionDeactivatedEvent,
  SubscriptionReactivatedEvent,
  SubscriptionRenewedEvent,
  SubscriptionRequestedEvent,
} from '../domain/events.js';

export const toPublicApiEvents = (
  domainEvents: DomainEvent[],
): SubscriptionPublicApiEvent[] => domainEvents.map(toPublicApiEvent);

const toPublicApiEvent = (event: DomainEvent): SubscriptionPublicApiEvent => {
  if (event instanceof SubscriptionRequestedEvent) {
    return {
      type: SubscriptionEventType.Requested,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        email: event.payload.email.value,
        repo: event.payload.repoPath.toString(),
        confirmationToken: event.payload.confirmationToken.value,
      },
    };
  }

  if (event instanceof SubscriptionConfirmationRenewedEvent) {
    return {
      type: SubscriptionEventType.ConfirmationRenewed,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        email: event.payload.email.value,
        repo: event.payload.repoPath.toString(),
        confirmationToken: event.payload.confirmationToken.value,
      },
    };
  }

  if (event instanceof SubscriptionReactivatedEvent) {
    return {
      type: SubscriptionEventType.Reactivated,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        email: event.payload.email.value,
        repo: event.payload.repoPath.toString(),
        confirmationToken: event.payload.confirmationToken.value,
      },
    };
  }

  if (event instanceof SubscriptionConfirmedEvent) {
    return {
      type: SubscriptionEventType.Confirmed,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        email: event.payload.email.value,
        repo: event.payload.repoPath.toString(),
        unsubscribeToken: event.payload.unsubscribeToken.value,
      },
    };
  }

  if (event instanceof SubscriptionDeactivatedEvent) {
    return {
      type: SubscriptionEventType.Deactivated,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        repo: event.payload.repoPath.toString(),
      },
    };
  }

  if (event instanceof SubscriptionRenewedEvent) {
    return {
      type: SubscriptionEventType.Renewed,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: {
        repo: event.payload.repoPath.toString(),
      },
    };
  }

  throw new Error(
    `Unknown subscription domain event type: ${event.constructor.name}`,
  );
};
