import { describe, it, expect } from 'vitest';
import { Email } from '../../src/domain/subscription/email.js';
import { RepoPath } from '../../src/domain/subscription/repo-path.js';
import { ConfirmationToken } from '../../src/domain/subscription/confirmation-token.js';
import { ConfirmationTokenScope } from '../../src/domain/subscription/confirmation-token-scope.js';
import { ReleaseTag } from '../../src/domain/subscription/release-tag.js';
import { Subscription } from '../../src/domain/subscription/subscription.js';
import { SubscriptionStatus } from '../../src/domain/subscription/subscription-status.js';
import {
  IllegalStateTransitionError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
  WrongTokenScopeError,
} from '../../src/domain/subscription/errors.js';

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
  overrides: Partial<Parameters<typeof ConfirmationToken.issue>[0]> = {},
) =>
  ConfirmationToken.issue({
    value: CONFIRM_TOKEN_UUID,
    scope: ConfirmationTokenScope.Subscribe,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    ...overrides,
  });

const issueUnsubscribeToken = (
  overrides: Partial<Parameters<typeof ConfirmationToken.issue>[0]> = {},
) =>
  ConfirmationToken.issue({
    value: UNSUBSCRIBE_TOKEN_UUID,
    scope: ConfirmationTokenScope.Unsubscribe,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    ...overrides,
  });

const requestSubscription = () =>
  Subscription.request(SUBSCRIPTION_ID, EMAIL, REPO_PATH, issueConfirmToken());

const confirmSubscription = (subscription = requestSubscription()) => {
  subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueUnsubscribeToken());

  return subscription;
};

describe('Subscription', () => {
  describe('request', () => {
    it('should create a pending subscription with the expected properties', () => {
      const confirmationToken = issueConfirmToken();
      const subscription = Subscription.request(
        SUBSCRIPTION_ID,
        EMAIL,
        REPO_PATH,
        confirmationToken,
      );

      expect(subscription.id).toBe(SUBSCRIPTION_ID);
      expect(subscription.email).toBe(EMAIL);
      expect(subscription.repoPath).toBe(REPO_PATH);
      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.lastSeenTag).toBeNull();
    });

    it('should throw WrongTokenScopeError when confirmation token has wrong scope', () => {
      expect(() =>
        Subscription.request(
          SUBSCRIPTION_ID,
          EMAIL,
          REPO_PATH,
          issueUnsubscribeToken(),
        ),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        Subscription.request(
          SUBSCRIPTION_ID,
          EMAIL,
          REPO_PATH,
          issueUnsubscribeToken(),
        ),
      ).toThrow('Wrong token scope: expected subscribe, got unsubscribe');
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
        lastSeenTag: null,
        confirmationToken,
        unsubscribeToken: null,
      });

      expect(subscription.id).toBe(SUBSCRIPTION_ID);
      expect(subscription.email).toBe(EMAIL);
      expect(subscription.repoPath).toBe(REPO_PATH);
      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.lastSeenTag).toBeNull();
    });

    it('should restore a confirmed subscription with an unsubscribe token', () => {
      const lastSeenTag = ReleaseTag.fromString('v1.0.0');

      const subscription = Subscription.rehydrate({
        id: SUBSCRIPTION_ID,
        email: EMAIL,
        repoPath: REPO_PATH,
        status: SubscriptionStatus.Confirmed,
        lastSeenTag,
        confirmationToken: issueConfirmToken(),
        unsubscribeToken: issueUnsubscribeToken(),
      });

      expect(subscription.status).toBe(SubscriptionStatus.Confirmed);
      expect(subscription.lastSeenTag?.equals(lastSeenTag)).toBe(true);
    });

    it('should throw when confirmed subscription has no unsubscribe token', () => {
      expect(() =>
        Subscription.rehydrate({
          id: SUBSCRIPTION_ID,
          email: EMAIL,
          repoPath: REPO_PATH,
          status: SubscriptionStatus.Confirmed,
          lastSeenTag: null,
          confirmationToken: issueConfirmToken(),
          unsubscribeToken: null,
        }),
      ).toThrow('Unsubscribe token is required for confirmed subscriptions');
    });
  });

  describe('confirm', () => {
    it('should confirm a pending subscription', () => {
      const subscription = requestSubscription();

      subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueUnsubscribeToken());

      expect(subscription.status).toBe(SubscriptionStatus.Confirmed);
    });

    it('should throw WrongTokenScopeError for an invalid confirmation token', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.confirm('invalid-token', NOW, issueUnsubscribeToken()),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.confirm('invalid-token', NOW, issueUnsubscribeToken()),
      ).toThrow('Wrong token scope: expected subscribe, got unknown');
    });

    it('should throw IllegalStateTransitionError when not pending', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueUnsubscribeToken()),
      ).toThrow(SubscriptionAlreadyConfirmedError);
      expect(() =>
        subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueUnsubscribeToken()),
      ).toThrow('Subscription already confirmed');
    });

    it('should throw WrongTokenScopeError when unsubscribe token has wrong scope', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueConfirmToken()),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.confirm(CONFIRM_TOKEN_UUID, NOW, issueConfirmToken()),
      ).toThrow('Wrong token scope: expected unsubscribe, got subscribe');
    });
  });

  describe('renewConfirmation', () => {
    it('should replace the confirmation token for a pending subscription', () => {
      const subscription = requestSubscription();
      const renewedToken = issueConfirmToken({
        value: RENEWED_CONFIRM_TOKEN_UUID,
      });

      subscription.renewConfirmation(renewedToken);

      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toBe(renewedToken);
      expect(subscription.confirmationToken.value).toBe(
        RENEWED_CONFIRM_TOKEN_UUID,
      );
      expect(subscription.unsubscribeToken).toBeNull();
    });

    it('should throw WrongTokenScopeError when new token has wrong scope', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.renewConfirmation(issueUnsubscribeToken()),
      ).toThrow(WrongTokenScopeError);
      expect(() =>
        subscription.renewConfirmation(issueUnsubscribeToken()),
      ).toThrow('Wrong token scope: expected subscribe, got unsubscribe');
    });

    it('should throw SubscriptionAlreadyConfirmedError when already confirmed', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow(SubscriptionAlreadyConfirmedError);
      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow('Subscription already confirmed');
    });

    it('should throw SubscriptionAlreadyDeactivatedError when unsubscribed', () => {
      const subscription = confirmSubscription();
      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow(SubscriptionAlreadyDeactivatedError);
      expect(() =>
        subscription.renewConfirmation(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow('Subscription already deactivated');
    });
  });

  describe('reactivate', () => {
    const unsubscribedSubscription = () => {
      const subscription = confirmSubscription();
      subscription.unsubscribe(UNSUBSCRIBE_TOKEN_UUID, NOW);

      return subscription;
    };

    it('should move an unsubscribed subscription back to pending with a new confirmation token', () => {
      const subscription = unsubscribedSubscription();
      const reactivationToken = issueConfirmToken({
        value: RENEWED_CONFIRM_TOKEN_UUID,
      });

      subscription.reactivate(reactivationToken);

      expect(subscription.status).toBe(SubscriptionStatus.Pending);
      expect(subscription.confirmationToken).toBe(reactivationToken);
      expect(subscription.unsubscribeToken).toBeNull();
    });

    it('should throw WrongTokenScopeError when new token has wrong scope', () => {
      const subscription = unsubscribedSubscription();

      expect(() => subscription.reactivate(issueUnsubscribeToken())).toThrow(
        WrongTokenScopeError,
      );
      expect(() => subscription.reactivate(issueUnsubscribeToken())).toThrow(
        'Wrong token scope: expected subscribe, got unsubscribe',
      );
    });

    it('should throw SubscriptionAlreadyConfirmedError when already confirmed', () => {
      const subscription = confirmSubscription();

      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow(SubscriptionAlreadyConfirmedError);
    });

    it('should throw IllegalStateTransitionError when subscription is pending', () => {
      const subscription = requestSubscription();

      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
        ),
      ).toThrow(IllegalStateTransitionError);
      expect(() =>
        subscription.reactivate(
          issueConfirmToken({ value: RENEWED_CONFIRM_TOKEN_UUID }),
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

  describe('observeRelease', () => {
    it('should record the release tag for a confirmed subscription', () => {
      const subscription = confirmSubscription();
      const tag = ReleaseTag.fromString('v1.0.0');

      subscription.observeRelease(tag);

      expect(subscription.lastSeenTag?.equals(tag)).toBe(true);
    });

    it('should ignore releases when the subscription is not confirmed', () => {
      const subscription = requestSubscription();
      const tag = ReleaseTag.fromString('v1.0.0');

      subscription.observeRelease(tag);

      expect(subscription.lastSeenTag).toBeNull();
    });

    it('should ignore duplicate release tags', () => {
      const subscription = confirmSubscription();
      const firstTag = ReleaseTag.fromString('v1.0.0');
      const duplicateTag = ReleaseTag.fromString('v1.0.0');

      subscription.observeRelease(firstTag);
      subscription.observeRelease(duplicateTag);

      expect(subscription.lastSeenTag).toBe(firstTag);
    });

    it('should update the release tag when a new tag is observed', () => {
      const subscription = confirmSubscription();

      subscription.observeRelease(ReleaseTag.fromString('v1.0.0'));
      subscription.observeRelease(ReleaseTag.fromString('v1.0.1'));

      expect(subscription.lastSeenTag?.value).toBe('v1.0.1');
    });
  });
});
