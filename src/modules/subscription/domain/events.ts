import { DomainEvent } from '../../../shared-kernel/index.js';
import type { Email } from './email.js';
import type { RepoPath } from './repo-path.js';
import type { SubscriptionToken } from './subscription-token.js';

type SubscriptionConfirmedEventPayload = {
  repoPath: RepoPath;
};

export class SubscriptionConfirmedEvent extends DomainEvent<SubscriptionConfirmedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionConfirmedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}

type SubscriptionDeactivatedEventPayload = {
  repoPath: RepoPath;
};

export class SubscriptionDeactivatedEvent extends DomainEvent<SubscriptionDeactivatedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionDeactivatedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}

type SubscriptionConfirmationRenewedEventPayload = {
  repoPath: RepoPath;
  email: Email;
  confirmationToken: SubscriptionToken;
};

export class SubscriptionConfirmationRenewedEvent extends DomainEvent<SubscriptionConfirmationRenewedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionConfirmationRenewedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}

type SubscriptionReactivatedEventPayload = {
  repoPath: RepoPath;
  email: Email;
  confirmationToken: SubscriptionToken;
};

export class SubscriptionReactivatedEvent extends DomainEvent<SubscriptionReactivatedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionReactivatedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}

type SubscriptionRenewedEventPayload = {
  repoPath: RepoPath;
};

export class SubscriptionRenewedEvent extends DomainEvent<SubscriptionRenewedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionRenewedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}

type SubscriptionRequestedEventPayload = {
  repoPath: RepoPath;
  email: Email;
  confirmationToken: SubscriptionToken;
};

export class SubscriptionRequestedEvent extends DomainEvent<SubscriptionRequestedEventPayload> {
  constructor(
    aggregateId: string,
    payload: SubscriptionRequestedEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, payload, occurredAt);
  }
}
