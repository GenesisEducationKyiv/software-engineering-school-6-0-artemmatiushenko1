import {
  Email,
  SubscriptionTokenScope,
  Subscription,
  SubscriptionToken,
  RepoPath,
  SubscriptionStatus,
} from '../domain/index.js';

export const FIXED_NOW = new Date('2026-01-01T12:00:00Z');
export const TOKEN_EXPIRES_AT = new Date('2026-01-01T13:00:00Z');
export const CONFIRM_TOKEN_EXPIRES_AT = new Date('2026-01-01T12:01:00Z');

export const createPendingSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) =>
  Subscription.rehydrate({
    id: overrides.id ?? '1',
    email: Email.fromString(overrides.email ?? 'test@example.com'),
    repoPath: RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    status: SubscriptionStatus.Pending,
    lastSeenTag: null,
    confirmationToken: SubscriptionToken.rehydrate({
      value: '550e8400-e29b-41d4-a716-446655440000',
      scope: SubscriptionTokenScope.Confirm,
      expiresAt: TOKEN_EXPIRES_AT,
    }),
    unsubscribeToken: null,
  });

export const createConfirmedSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createPendingSubscription(overrides);
  subscription.confirm(
    '550e8400-e29b-41d4-a716-446655440000',
    FIXED_NOW,
    SubscriptionToken.rehydrate({
      value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      scope: SubscriptionTokenScope.Unsubscribe,
      expiresAt: TOKEN_EXPIRES_AT,
    }),
  );

  return subscription;
};

export const createUnsubscribedSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createConfirmedSubscription(overrides);
  subscription.unsubscribe('6ba7b810-9dad-11d1-80b4-00c04fd430c8', FIXED_NOW);

  return subscription;
};
