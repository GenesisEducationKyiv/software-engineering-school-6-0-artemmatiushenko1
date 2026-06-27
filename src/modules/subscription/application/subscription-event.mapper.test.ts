import { describe, it, expect } from 'vitest';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import { SubscriptionRequestedEvent } from '../domain/events.js';
import { SubscriptionConfirmationRenewedEvent } from '../domain/events.js';
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
});
