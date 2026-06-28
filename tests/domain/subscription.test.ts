import { describe, it, expect } from 'vitest';
import { Email, RepoPath, ReleaseTag } from '../../src/shared-kernel/index.js';
import { SubscriptionToken } from '../../src/modules/subscription/domain/subscription-token.js';
import { SubscriptionTokenScope } from '../../src/modules/subscription/domain/subscription-token-scope.js';
import { Subscription } from '../../src/modules/subscription/domain/subscription.js';
import { SubscriptionStatus } from '../../src/modules/subscription/domain/subscription-status.js';
import {
  IllegalStateTransitionError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
  WrongTokenScopeError,
} from '../../src/modules/subscription/domain/errors.js';
import {
  SubscriptionDeactivatedEvent,
  SubscriptionConfirmedEvent,
} from '../../src/modules/subscription/domain/events.js';

const SUBSCRIPTION_ID = 'sub-1';
const EMAIL = Email.fromString('test@example.com');
const REPO_PATH = RepoPath.fromString('owner/repo');
const CONFIRM_TOKEN_UUID = '550e8400-e29b-41d4-a716-446655440000';
const RENEWED_CONFIRM_TOKEN_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const UNSUBSCRIBE_TOKEN_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const ISSUED_AT = new Date('2026-01-01T12:00:00Z');
const NOW = new Date('2026-01-01T12:30:00Z');
const TTL_MS = 3_600_000;

const issueConfirmToken = (
  overrides: Partial<Parameters<typeof SubscriptionToken.issue>[0]> = {},
) =>
  SubscriptionToken.issue({
    value: CONFIRM_TOKEN_UUID,
    scope: SubscriptionTokenScope.Confirm,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    ...overrides,
  });

const issueUnsubscribeToken = (
  overrides: Partial<Parameters<typeof SubscriptionToken.issue>[0]> = {},
) =>
  SubscriptionToken.issue({
    value: UNSUBSCRIBE_TOKEN_UUID,
    scope: SubscriptionTokenScope.Unsubscribe,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    ...overrides,
  });

const requestSubscription = () =>
  Subscription.request(
    SUBSCRIPTION_ID,
    EMAIL,
    REPO_PATH,
    issueConfirmToken(),
    ISSUED_AT,
  );

const confirmSubscription = (
  subscription = requestSubscription(),
  baselineTag: ReleaseTag | null = null,
) => {
  subscription.confirm(
    CONFIRM_TOKEN_UUID,
    NOW,
    issueUnsubscribeToken(),
    baselineTag,
  );

  return subscription;
};

const unsubscribedSubscription = () => {
  const subscription = confirmSubscription();
  subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

  return subscription;
};

describe('Subscription', () => {
  describe('request', () => {
    it('should create a pending subscription with the expected properties', () => {
      const subscriptionToken = issueConfirmToken();
      const subscription = Subscription.request(
        SUBSCRIPTION_ID,
        EMAIL,
        REPO_PATH,
        subscriptionToken,
        ISSUED_AT,
      );

      expect(subscription.id).toBe(SUBSCRIPTION_ID);
      expect(subscription.email).toBe(EMAIL);
      expect(subscription.repoPath).toBe(REPO_PATH);
      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toBe(subscriptionToken);
    });

    it('should throw WrongTokenScopeError when confirmation token has wrong scope', () => {
      expect(() =>
        Subscription.request(
          SUBSCRIPTION_ID,
          EMAIL,
          REPO_PATH,
          issueUnsubscribeToken(),
          ISSUED_AT,
        ),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        Subscription.request(
          SUBSCRIPTION_ID,
          EMAIL,
          REPO_PATH,
          issueUnsubscribeToken(),
          ISSUED_AT,
        ),
      ).toThrow('Wrong token scope: expected confirm, got unsubscribe');
    });
  });

  describe('rehydrate', () => {
    it('should restore a pending subscription with the expected properties', () => {
      const confirmationToken = issueConfirmToken();

      const subscription = Subscription.rehydrate({
        id: SUBSCRIPTION_ID,
        email: EMAIL,
        repoPath: REPO_PATH,
        status: SubscriptionStatus.Pending,
        confirmationToken,
        unsubscribeToken: null,
      });

      expect(subscription.id).toBe(SUBSCRIPTION_ID);
      expect(subscription.email).toBe(EMAIL);
      expect(subscription.repoPath).toBe(REPO_PATH);
      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toBe(confirmationToken);
    });

    it('should restore a confirmed subscription with an unsubscribe token', () => {
      const unsubscribeToken = issueUnsubscribeToken();
      const confirmationToken = issueConfirmToken();

      const subscription = Subscription.rehydrate({
        id: SUBSCRIPTION_ID,
        email: EMAIL,
        repoPath: REPO_PATH,
        status: SubscriptionStatus.Confirmed,
        confirmationToken,
        unsubscribeToken,
      });

      expect(subscription.id).toBe(SUBSCRIPTION_ID);
      expect(subscription.email).toBe(EMAIL);
      expect(subscription.repoPath).toBe(REPO_PATH);
      expect(subscription.status).toBe(SubscriptionStatus.Confirmed);
      expect(subscription.unsubscribeToken).toBe(unsubscribeToken);
      expect(subscription.confirmationToken).toBe(confirmationToken);
    });

    it('should throw when confirmed subscription has no unsubscribe token', () => {
      expect(() =>
        Subscription.rehydrate({
          id: SUBSCRIPTION_ID,
          email: EMAIL,
          repoPath: REPO_PATH,
          status: SubscriptionStatus.Confirmed,
          confirmationToken: issueConfirmToken(),
          unsubscribeToken: null,
        }),
      ).toThrow('Unsubscribe token is required for confirmed subscriptions');
    });
  });

  describe('confirm', () => {
    it('should confirm a pending subscription', () => {
      const subscription = requestSubscription();

      subscription.confirm(
        CONFIRM_TOKEN_UUID,
        NOW,
        issueUnsubscribeToken(),
        null,
      );

      expect(subscription.status).toBe(SubscriptionStatus.Confirmed);
    });

    it('should throw WrongTokenScopeError for an invalid confirmation token', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.confirm(
          'invalid-token',
          NOW,
          issueUnsubscribeToken(),
          null,
        ),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.confirm(
          'invalid-token',
          NOW,
          issueUnsubscribeToken(),
          null,
        ),
      ).toThrow('Wrong token scope: expected confirm, got unknown');
    });

    it('should throw SubscriptionAlreadyConfirmedError when not pending', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.confirm(
          CONFIRM_TOKEN_UUID,
          NOW,
          issueUnsubscribeToken(),
          null,
        ),
      ).toThrow(SubscriptionAlreadyConfirmedError);
      expect(() =>
        subscription.confirm(
          CONFIRM_TOKEN_UUID,
          NOW,
          issueUnsubscribeToken(),
          null,
        ),
      ).toThrow('Subscription already confirmed');
    });

    it('should include baselineTag in SubscriptionConfirmed event', () => {
      const subscription = requestSubscription();
      subscription.pullEvents();
      const baselineTag = ReleaseTag.fromString('v1.0.0');

      subscription.confirm(
        CONFIRM_TOKEN_UUID,
        NOW,
        issueUnsubscribeToken(),
        baselineTag,
      );

      const [event] = subscription.pullEvents();
      expect(event).toBeInstanceOf(SubscriptionConfirmedEvent);
      expect((event as SubscriptionConfirmedEvent).payload.baselineTag).toEqual(
        baselineTag,
      );
    });

    it('should throw WrongTokenScopeError when unsubscribe token has wrong scope', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.confirm(
          CONFIRM_TOKEN_UUID,
          NOW,
          issueConfirmToken(),
          null,
        ),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.confirm(
          CONFIRM_TOKEN_UUID,
          NOW,
          issueConfirmToken(),
          null,
        ),
      ).toThrow('Wrong token scope: expected unsubscribe, got confirm');
    });
  });

  describe('renewConfirmation', () => {
    it('should replace the confirmation token for a pending subscription', () => {
      const subscription = requestSubscription();
      const renewedToken = issueConfirmToken({
        value: RENEWED_CONFIRM_TOKEN_UUID,
      });

      subscription.renewConfirmation(renewedToken, NOW);

      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toEqual(renewedToken);
      expect(subscription.unsubscribeToken).toBeNull();
    });

    it('should throw WrongTokenScopeError when new token has wrong scope', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.renewConfirmation(issueUnsubscribeToken(), NOW),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.renewConfirmation(issueUnsubscribeToken(), NOW),
      ).toThrow('Wrong token scope: expected confirm, got unsubscribe');
    });

    it('should throw SubscriptionAlreadyConfirmedError when already confirmed', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow(SubscriptionAlreadyConfirmedError);
      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow('Subscription already confirmed');
    });

    it('should throw SubscriptionAlreadyDeactivatedError when unsubscribed', () => {
      const subscription = confirmSubscription();
      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow(SubscriptionAlreadyDeactivatedError);
      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow('Subscription already deactivated');
    });
  });

  describe('reactivate', () => {
    it('should move an unsubscribed subscription back to pending with a new confirmation token', () => {
      const subscription = unsubscribedSubscription();
      const reactivationToken = issueConfirmToken({
        value: RENEWED_CONFIRM_TOKEN_UUID,
      });

      subscription.reactivate(reactivationToken, NOW);

      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toBe(reactivationToken);
      expect(subscription.unsubscribeToken).toBeNull();
    });

    it('should throw WrongTokenScopeError when new token has wrong scope', () => {
      const subscription = unsubscribedSubscription();

      expect(() =>
        subscription.reactivate(issueUnsubscribeToken(), NOW),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.reactivate(issueUnsubscribeToken(), NOW),
      ).toThrow('Wrong token scope: expected confirm, got unsubscribe');
    });

    it('should throw IllegalStateTransitionError when already confirmed', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow(IllegalStateTransitionError);
      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow('Illegal state transition from confirmed to pending');
    });

    it('should throw IllegalStateTransitionError when subscription is pending', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow(IllegalStateTransitionError);
      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
          NOW,
        ),
      ).toThrow('Illegal state transition from pending to pending');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe a confirmed subscription', () => {
      const subscription = confirmSubscription();

      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      expect(subscription.status).toBe(SubscriptionStatus.Unsubscribed);
    });

    it('should emit SubscriptionDeactivatedEvent', () => {
      const subscription = confirmSubscription();
      subscription.pullEvents();

      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      const events = subscription.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionDeactivatedEvent);
      expect(events[0]).toMatchObject({
        aggregateId: SUBSCRIPTION_ID,
        occurredAt: NOW,
        payload: {
          repoPath: REPO_PATH,
        },
      });
    });

    it('should throw WrongTokenScopeError for an invalid unsubscribe token', () => {
      const subscription = confirmSubscription();

      expect(() => subscription.unsubscribe('invalid-token', NOW)).toThrow(
        WrongTokenScopeError,
      );
      expect(() => subscription.unsubscribe('invalid-token', NOW)).toThrow(
        'Wrong token scope: expected unsubscribe, got unknown',
      );
    });

    it('should throw WrongTokenScopeError when unsubscribe token is not set', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW),
      ).toThrow('Wrong token scope: expected unsubscribe, got unknown');
    });

    it('should throw IllegalStateTransitionError when already unsubscribed', () => {
      const subscription = confirmSubscription();
      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      expect(() =>
        subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW),
      ).toThrow(IllegalStateTransitionError);
      expect(() =>
        subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW),
      ).toThrow('Illegal state transition from unsubscribed to unsubscribed');
    });
  });
});
