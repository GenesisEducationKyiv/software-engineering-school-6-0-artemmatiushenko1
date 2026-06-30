import { describe, it, expect } from 'vitest';
import { Email, RepoPath } from '../../../shared-kernel/index.js';
import { SubscriptionRequestedEvent } from '../domain/events.js';
import { SubscriptionConfirmationRenewedEvent } from '../domain/events.js';
import { SubscriptionReactivatedEvent } from '../domain/events.js';
import { SubscriptionConfirmedEvent } from '../domain/events.js';
import { SubscriptionDeactivatedEvent } from '../domain/events.js';
import { SubscriptionEventType } from '../api/events.js';
import { toPublicApiEvents } from './subscription-event.mapper.js';
import { SubscriptionToken } from '../domain/subscription-token.js';
import { SubscriptionTokenScope } from '../domain/subscription-token-scope.js';

describe('toPublicApiEvents', () => {
  const CONFIRM_TOKEN = '550e8400-e29b-41d4-a716-446655440000';
  const RENEWED_TOKEN = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const REACTIVATED_TOKEN = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const UNSUBSCRIBE_TOKEN = '8d3e2729-8f5c-4b1a-9c2d-1e4f6a8b0c2d';

  it('maps SubscriptionRequested domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionRequestedEvent(
      'sub-1',
      {
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/repo'),
        confirmationToken: SubscriptionToken.rehydrate({
          value: CONFIRM_TOKEN,
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
        }),
      },
      occurredAt,
    );

    expect(toPublicApiEvents([domainEvent])).toEqual([
      {
        type: SubscriptionEventType.Requested,
        aggregateId: 'sub-1',
        occurredAt,
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmationToken: CONFIRM_TOKEN,
        },
      },
    ]);
  });

  it('maps SubscriptionConfirmationRenewed domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionConfirmationRenewedEvent(
      'sub-1',
      {
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/repo'),
        confirmationToken: SubscriptionToken.rehydrate({
          value: RENEWED_TOKEN,
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
        }),
      },
      occurredAt,
    );

    expect(toPublicApiEvents([domainEvent])).toEqual([
      {
        type: SubscriptionEventType.ConfirmationRenewed,
        aggregateId: 'sub-1',
        occurredAt,
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmationToken: RENEWED_TOKEN,
        },
      },
    ]);
  });

  it('maps SubscriptionReactivated domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionReactivatedEvent(
      'sub-1',
      {
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/repo'),
        confirmationToken: SubscriptionToken.rehydrate({
          value: REACTIVATED_TOKEN,
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
        }),
      },
      occurredAt,
    );

    expect(toPublicApiEvents([domainEvent])).toEqual([
      {
        type: SubscriptionEventType.Reactivated,
        aggregateId: 'sub-1',
        occurredAt,
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmationToken: REACTIVATED_TOKEN,
        },
      },
    ]);
  });

  it('maps SubscriptionConfirmed domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionConfirmedEvent(
      'sub-1',
      {
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/repo'),
        unsubscribeToken: SubscriptionToken.rehydrate({
          value: UNSUBSCRIBE_TOKEN,
          scope: SubscriptionTokenScope.Unsubscribe,
          expiresAt: null,
        }),
      },
      occurredAt,
    );

    expect(toPublicApiEvents([domainEvent])).toEqual([
      {
        type: SubscriptionEventType.Confirmed,
        aggregateId: 'sub-1',
        occurredAt,
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
          unsubscribeToken: UNSUBSCRIBE_TOKEN,
        },
      },
    ]);
  });

  it('maps SubscriptionDeactivated domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionDeactivatedEvent(
      'sub-1',
      {
        repoPath: RepoPath.fromString('owner/repo'),
      },
      occurredAt,
    );

    expect(toPublicApiEvents([domainEvent])).toEqual([
      {
        type: SubscriptionEventType.Deactivated,
        aggregateId: 'sub-1',
        occurredAt,
        payload: {
          repo: 'owner/repo',
        },
      },
    ]);
  });
});
