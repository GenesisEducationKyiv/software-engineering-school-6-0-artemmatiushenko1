import { describe, it, expect } from 'vitest';
import { SubscriptionToken } from '../../src/domain/subscription/subscription-token.js';
import { SubscriptionTokenScope } from '../../src/domain/subscription/subscription-token-scope.js';
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
} from '../../src/domain/subscription/errors.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISSUED_AT = new Date('2026-01-01T12:00:00Z');
const TTL_MS = 3_600_000;

const issueToken = (
  overrides: Partial<Parameters<typeof SubscriptionToken.issue>[0]> = {},
) =>
  SubscriptionToken.issue({
    value: VALID_UUID,
    scope: SubscriptionTokenScope.Confirm,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    ...overrides,
  });

describe('SubscriptionToken', () => {
  describe('issue', () => {
    it('should create a token with the expected properties', () => {
      const token = issueToken({ scope: SubscriptionTokenScope.Confirm });

      expect(token.value).toBe(VALID_UUID);
      expect(token.scope).toBe(SubscriptionTokenScope.Confirm);
      expect(token.consumedAt).toBeNull();
      expect(token.expiresAt).toEqual(new Date(ISSUED_AT.getTime() + TTL_MS));
    });

    it('should create a non-expiring token when ttlMs is omitted', () => {
      const token = SubscriptionToken.issue({
        value: VALID_UUID,
        scope: SubscriptionTokenScope.Unsubscribe,
        issuedAt: ISSUED_AT,
      });

      expect(token.expiresAt).toBeNull();
    });

    it('should throw InvalidTokenError when unsubscribe token is issued with TTL', () => {
      expect(() =>
        SubscriptionToken.issue({
          value: VALID_UUID,
          scope: SubscriptionTokenScope.Unsubscribe,
          issuedAt: ISSUED_AT,
          ttlMs: TTL_MS,
        }),
      ).toThrow(InvalidTokenError);
      expect(() =>
        SubscriptionToken.issue({
          value: VALID_UUID,
          scope: SubscriptionTokenScope.Unsubscribe,
          issuedAt: ISSUED_AT,
          ttlMs: TTL_MS,
        }),
      ).toThrow(
        'Invalid token: TTL must not be specified for unsubscribe tokens.',
      );
    });

    it('should throw InvalidTokenError when confirm token is issued without TTL', () => {
      expect(() =>
        SubscriptionToken.issue({
          value: VALID_UUID,
          scope: SubscriptionTokenScope.Confirm,
          issuedAt: ISSUED_AT,
          ttlMs: 0,
        }),
      ).toThrow(InvalidTokenError);
      expect(() =>
        SubscriptionToken.issue({
          value: VALID_UUID,
          scope: SubscriptionTokenScope.Confirm,
          issuedAt: ISSUED_AT,
        }),
      ).toThrow('Invalid token: TTL is required for confirm tokens.');
    });

    it('should accept confirm scope', () => {
      const token = issueToken({ scope: SubscriptionTokenScope.Confirm });

      expect(token.scope).toBe(SubscriptionTokenScope.Confirm);
    });

    it('should accept unsubscribe scope', () => {
      const token = SubscriptionToken.issue({
        value: VALID_UUID,
        scope: SubscriptionTokenScope.Unsubscribe,
        issuedAt: ISSUED_AT,
      });

      expect(token.scope).toBe(SubscriptionTokenScope.Unsubscribe);
    });

    it.each(['not-a-uuid', '', '123'])(
      'should throw InvalidTokenError for invalid value: %s',
      (value) => {
        expect(() => issueToken({ value })).toThrow(InvalidTokenError);
        expect(() => issueToken({ value })).toThrow(
          `Invalid token: Invalid value: ${value}. Expected a valid UUID.`,
        );
      },
    );

    it.each([0, -1])(
      'should throw InvalidTokenError for invalid TTL: %s',
      (ttlMs) => {
        expect(() => issueToken({ ttlMs })).toThrow(InvalidTokenError);
        expect(() => issueToken({ ttlMs })).toThrow(
          `Invalid token: Invalid TTL: ${ttlMs}. Expected a positive number.`,
        );
      },
    );
  });

  describe('consume', () => {
    it('should return a consumed token without mutating the original', () => {
      const token = issueToken();
      const consumedAt = new Date('2026-01-01T12:30:00Z');

      const consumed = token.consume(consumedAt);

      expect(consumed.value).toBe(token.value);
      expect(consumed.scope).toBe(token.scope);
      expect(consumed.expiresAt).toEqual(token.expiresAt);
      expect(consumed.consumedAt).toEqual(consumedAt);
      expect(token.consumedAt).toBeNull();
      expect(token).not.toBe(consumed);
    });

    it('should allow consumption exactly at expiration time', () => {
      const token = issueToken();
      const expiresAt = token.expiresAt;

      expect(() => token.consume(expiresAt!)).not.toThrow();
    });

    it('should throw TokenExpiredError when the token has expired', () => {
      const token = issueToken({ ttlMs: 1_000 });

      expect(() =>
        token.consume(new Date(ISSUED_AT.getTime() + 1_001)),
      ).toThrow(TokenExpiredError);
      expect(() =>
        token.consume(new Date(ISSUED_AT.getTime() + 1_001)),
      ).toThrow('Token is expired');
    });

    it('should not expire when expiresAt is null', () => {
      const token = SubscriptionToken.issue({
        value: VALID_UUID,
        scope: SubscriptionTokenScope.Unsubscribe,
        issuedAt: ISSUED_AT,
      });

      expect(() =>
        token.consume(new Date('2099-01-01T00:00:00Z')),
      ).not.toThrow();
    });

    it('should throw TokenAlreadyUsedError when the token was already consumed', () => {
      const token = issueToken();
      const consumedAt = new Date('2026-01-01T12:30:00Z');
      const consumed = token.consume(consumedAt);

      expect(() => consumed.consume(consumedAt)).toThrow(TokenAlreadyUsedError);
      expect(() => consumed.consume(consumedAt)).toThrow('Token already used');
    });
  });

  describe('equals', () => {
    it('should return true for tokens with the same properties', () => {
      const first = issueToken();
      const second = issueToken();

      expect(first.equals(second)).toBe(true);
    });

    it('should return false when value differs', () => {
      const first = issueToken();
      const second = issueToken({
        value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });

      expect(first.equals(second)).toBe(false);
    });

    it('should return false when scope differs', () => {
      const first = issueToken({ scope: SubscriptionTokenScope.Confirm });
      const second = SubscriptionToken.issue({
        value: VALID_UUID,
        scope: SubscriptionTokenScope.Unsubscribe,
        issuedAt: ISSUED_AT,
      });

      expect(first.equals(second)).toBe(false);
    });

    it('should return false when expiration differs', () => {
      const first = issueToken({ ttlMs: TTL_MS });
      const second = issueToken({ ttlMs: TTL_MS + 1 });

      expect(first.equals(second)).toBe(false);
    });

    it('should return false when consumed state differs', () => {
      const token = issueToken();
      const consumedAt = new Date('2026-01-01T12:30:00Z');
      const consumed = token.consume(consumedAt);

      expect(token.equals(consumed)).toBe(false);
    });

    it('should return true for consumed tokens with the same properties', () => {
      const consumedAt = new Date('2026-01-01T12:30:00Z');
      const first = issueToken().consume(consumedAt);
      const second = issueToken().consume(consumedAt);

      expect(first.equals(second)).toBe(true);
    });
  });

  it('should be immutable', () => {
    const token = issueToken();

    expect(Object.isFrozen(token)).toBe(true);
    expect(
      Object.isFrozen(token.consume(new Date('2026-01-01T12:30:00Z'))),
    ).toBe(true);
  });
});
