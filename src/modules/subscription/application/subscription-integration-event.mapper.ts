import type { DomainEvent } from '../../../shared-kernel/domain-event.js';
import {
  SubscriptionEventType,
  type SubscriptionIntegrationEvent,
} from '../api/events.js';
import {
  SubscriptionConfirmedEvent,
  SubscriptionDeactivatedEvent,
  SubscriptionRenewedEvent,
  SubscriptionRequestedEvent,
} from '../domain/events.js';

// TODO: rename to toPublicApiEvents
export const toIntegrationEvents = (
  domainEvents: DomainEvent[],
): SubscriptionIntegrationEvent[] => domainEvents.map(toIntegrationEvent);

const toIntegrationEvent = (
  event: DomainEvent,
): SubscriptionIntegrationEvent => {
  if (event instanceof SubscriptionRequestedEvent) {
    return {
      type: SubscriptionEventType.Requested,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
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
      occurredAt: event.occurredAt,
      payload: {
        repo: event.payload.repoPath.toString(),
      },
    };
  }

  if (event instanceof SubscriptionDeactivatedEvent) {
    return {
      type: SubscriptionEventType.Deactivated,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
      payload: {
        repo: event.payload.repoPath.toString(),
      },
    };
  }

  if (event instanceof SubscriptionRenewedEvent) {
    return {
      type: SubscriptionEventType.Renewed,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
      payload: {
        repo: event.payload.repoPath.toString(),
      },
    };
  }

  throw new Error(`Unknown subscription domain event type: ${event.type}`);
};
