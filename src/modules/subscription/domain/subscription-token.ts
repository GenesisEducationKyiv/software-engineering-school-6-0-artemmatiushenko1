import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
} from './errors.js';
import { SubscriptionTokenScope } from './subscription-token-scope.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export class SubscriptionToken {
  private constructor(
    public readonly value: string,
    public readonly expiresAt: Date | null,
    public readonly scope: SubscriptionTokenScope,
    public readonly consumedAt: Date | null,
  ) {
    SubscriptionToken.assertValid({ value, scope, expiresAt });
    Object.freeze(this);
  }

  private static assertValid(params: {
    value: string;
    scope: SubscriptionTokenScope;
    expiresAt: Date | null;
  }): void {
    if (!isUuid(params.value)) {
      throw new InvalidTokenError(
        `Invalid value: ${params.value}. Expected a valid UUID.`,
      );
    }

    if (
      params.scope === SubscriptionTokenScope.Confirm &&
      params.expiresAt === null
    ) {
      throw new InvalidTokenError('Confirm tokens must have an expiry.');
    }

    if (
      params.scope === SubscriptionTokenScope.Unsubscribe &&
      params.expiresAt !== null
    ) {
      throw new InvalidTokenError('Unsubscribe tokens must not expire.');
    }
  }

  static rehydrate(params: {
    value: string;
    scope: SubscriptionTokenScope;
    expiresAt: Date | null;
    consumedAt?: Date | null;
  }): SubscriptionToken {
    return new SubscriptionToken(
      params.value,
      params.expiresAt,
      params.scope,
      params.consumedAt ?? null,
    );
  }

  static issue(params: {
    value: string;
    scope: SubscriptionTokenScope;
    issuedAt: Date;
    ttlMs?: number;
  }): SubscriptionToken {
    if (
      params.scope === SubscriptionTokenScope.Confirm &&
      params.ttlMs === undefined
    ) {
      throw new InvalidTokenError('TTL is required for confirm tokens.');
    }

    if (
      params.scope === SubscriptionTokenScope.Unsubscribe &&
      params.ttlMs !== undefined
    ) {
      throw new InvalidTokenError(
        'TTL must not be specified for unsubscribe tokens.',
      );
    }

    let expiresAt: Date | null = null;
    if (params.ttlMs !== undefined) {
      if (params.ttlMs <= 0) {
        throw new InvalidTokenError(
          `Invalid TTL: ${params.ttlMs}. Expected a positive number.`,
        );
      }

      expiresAt = new Date(params.issuedAt.getTime() + params.ttlMs);
    }

    return new SubscriptionToken(params.value, expiresAt, params.scope, null);
  }

  consume(now: Date): SubscriptionToken {
    if (this.consumedAt) {
      throw new TokenAlreadyUsedError();
    }

    if (this.expiresAt !== null && this.expiresAt < now) {
      throw new TokenExpiredError();
    }

    return new SubscriptionToken(this.value, this.expiresAt, this.scope, now);
  }

  equals(other: SubscriptionToken): boolean {
    return (
      this.value === other.value &&
      this.scope === other.scope &&
      (this.expiresAt?.getTime() ?? null) ===
        (other.expiresAt?.getTime() ?? null) &&
      (this.consumedAt?.getTime() ?? null) ===
        (other.consumedAt?.getTime() ?? null)
    );
  }
}
