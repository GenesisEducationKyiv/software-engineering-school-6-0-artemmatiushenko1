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
  it('maps SubscriptionRequested domain event to integration event', () => {
    const occurredAt = new Date('2026-01-01T12:00:00Z');

    const domainEvent = new SubscriptionRequestedEvent(
      'sub-1',
      {
        email: Email.fromString('test@example.com'),
        repoPath: RepoPath.fromString('owner/repo'),
        confirmationToken: SubscriptionToken.rehydrate({
          value: 'confirm-token',
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
          confirmationToken: 'confirm-token',
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
          value: 'renewed-token',
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
          confirmationToken: 'renewed-token',
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
          value: 'reactivated-token',
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
          confirmationToken: 'reactivated-token',
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
          value: 'unsub-token',
          scope: SubscriptionTokenScope.Unsubscribe,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
        }),
        baselineTag: 'v1.0.0',
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
          unsubscribeToken: 'unsub-token',
          baselineTag: 'v1.0.0',
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
