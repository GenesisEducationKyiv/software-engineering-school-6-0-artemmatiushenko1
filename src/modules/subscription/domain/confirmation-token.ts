import * as z from 'zod';
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
} from './errors.js';

export const ConfirmationTokenScopeSchema = z.enum(
  ['subscribe', 'unsubscribe'],
  {
    message: "Invalid scope. Expected 'subscribe' or 'unsubscribe'.",
  },
);

export type ConfirmationTokenScope = z.infer<
  typeof ConfirmationTokenScopeSchema
>;

export class ConfirmationToken {
  private constructor(
    public readonly value: string,
    public readonly expiresAt: Date,
    public readonly scope: ConfirmationTokenScope,
    public readonly consumedAt: Date | null,
  ) {
    Object.freeze(this);
  }

  static hydrate(params: {
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
    const parsedScope = ConfirmationTokenScopeSchema.safeParse(params.scope);

    if (!parsedScope.success) {
      throw new InvalidTokenError(
        `Invalid scope: ${params.scope}. Expected 'subscribe' or 'unsubscribe'.`,
      );
    }

    const parsedValue = z.uuid().safeParse(params.value);

    if (!parsedValue.success) {
      throw new InvalidTokenError(
        `Invalid value: ${params.value}. Expected a valid UUID.`,
      );
    }

    const parsedTtlMs = z.number().positive().safeParse(params.ttlMs);

    if (!parsedTtlMs.success) {
      throw new InvalidTokenError(
        `Invalid TTL: ${params.ttlMs}. Expected a positive number.`,
      );
    }

    return new ConfirmationToken(
      parsedValue.data,
      new Date(params.issuedAt.getTime() + parsedTtlMs.data),
      parsedScope.data,
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
