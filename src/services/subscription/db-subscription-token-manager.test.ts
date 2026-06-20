import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubscriptionTokenManager } from './db-subscription-token-manager.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { SubscriptionToken } from '../../domain/subscription.js';
import { mock } from 'vitest-mock-extended';

describe('DbSubscriptionTokenManager', () => {
  let tokenManager: SubscriptionTokenManager;
  const repoMock = mock<SubscriptionRepository>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    tokenManager = new SubscriptionTokenManager(repoMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTokenByValue', () => {
    it('should return token from repository', async () => {
      const tokenValue = 'test-token';
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId: '1',
        scope: 'subscribe',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      repoMock.findTokenByValue.mockResolvedValue(token);

      const result = await tokenManager.getTokenByValue(tokenValue);

      expect(result).toEqual(token);
      expect(repoMock.findTokenByValue).toHaveBeenCalledWith(tokenValue);
    });
  });

  describe('validateToken', () => {
    it('should return false if scope mismatches', async () => {
      const token: SubscriptionToken = {
        id: 1,
        token: 'some-token',
        subscriptionId: '1',
        scope: 'unsubscribe',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      };

      const result = await tokenManager.validateToken(token, 'subscribe');

      expect(result).toBe(false);
    });

    it('should return false and invalidate if token is expired', async () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const expiredDate = new Date('2026-04-11T11:59:59Z');
      vi.setSystemTime(now);

      const expiredToken: SubscriptionToken = {
        id: 1,
        token: 'expired-token',
        subscriptionId: '1',
        scope: 'subscribe',
        expiresAt: expiredDate,
        createdAt: new Date(),
      };

      const result = await tokenManager.validateToken(
        expiredToken,
        'subscribe',
      );

      expect(result).toBe(false);
      expect(repoMock.deleteToken).toHaveBeenCalledWith(
        'expired-token',
        undefined,
      );
    });

    it('should return true if it is valid and not expired', async () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const validUntil = new Date('2026-04-11T12:00:01Z');
      vi.setSystemTime(now);

      const validToken: SubscriptionToken = {
        id: 1,
        token: 'valid-token',
        subscriptionId: '1',
        scope: 'subscribe',
        expiresAt: validUntil,
        createdAt: new Date(),
      };

      const result = await tokenManager.validateToken(validToken, 'subscribe');

      expect(result).toBe(true);
      expect(repoMock.deleteToken).not.toHaveBeenCalled();
    });
  });

  describe('invalidateToken', () => {
    it('should call repository to delete token', async () => {
      await tokenManager.invalidateToken('token-to-delete');

      expect(repoMock.deleteToken).toHaveBeenCalledWith(
        'token-to-delete',
        undefined,
      );
    });
  });
});
