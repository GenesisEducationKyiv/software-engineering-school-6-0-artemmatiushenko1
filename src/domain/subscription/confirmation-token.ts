import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
} from './errors.js';
import { ConfirmationTokenScope } from './confirmation-token-scope.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export class ConfirmationToken {
  private constructor(
    public readonly value: string,
    public readonly expiresAt: Date,
    public readonly scope: ConfirmationTokenScope,
    public readonly consumedAt: Date | null,
  ) {
    Object.freeze(this);
  }

  static rehydrate(params: {
    value: string;
    scope: ConfirmationTokenScope;
    expiresAt: Date;
    consumedAt?: Date | null;
  }): ConfirmationToken {
    return new ConfirmationToken(
      params.value,
      params.expiresAt,
      params.scope,
      params.consumedAt ?? null,
    );
  }

  static issue(params: {
    value: string;
    scope: ConfirmationTokenScope;
    issuedAt: Date;
    ttlMs: number;
  }): ConfirmationToken {
    if (!isUuid(params.value)) {
      throw new InvalidTokenError(
        `Invalid value: ${params.value}. Expected a valid UUID.`,
      );
    }

    if (params.ttlMs <= 0) {
      throw new InvalidTokenError(
        `Invalid TTL: ${params.ttlMs}. Expected a positive number.`,
      );
    }

    return new ConfirmationToken(
      params.value,
      new Date(params.issuedAt.getTime() + params.ttlMs),
      params.scope,
      null,
    );
  }

  consume(now: Date): ConfirmationToken {
    if (this.consumedAt) {
      throw new TokenAlreadyUsedError('Token already used');
    }

    if (this.expiresAt < now) {
      throw new TokenExpiredError('Token expired');
    }

    return new ConfirmationToken(this.value, this.expiresAt, this.scope, now);
  }

  equals(other: ConfirmationToken): boolean {
    return (
      this.value === other.value &&
      this.scope === other.scope &&
      this.expiresAt.getTime() === other.expiresAt.getTime() &&
      (this.consumedAt?.getTime() ?? null) ===
        (other.consumedAt?.getTime() ?? null)
    );
  }
}
