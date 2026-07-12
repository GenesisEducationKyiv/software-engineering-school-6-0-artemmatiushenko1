/**
 * Transport-agnostic classification of a failure. Domain and application
 * errors declare their category; each transport (HTTP, gRPC) maps the
 * category to its own status code, so error classes stay free of HTTP/gRPC
 * concerns and transports stay free of module imports.
 */
export enum ErrorCategory {
  Validation = 'VALIDATION',
  NotFound = 'NOT_FOUND',
  AlreadyExists = 'ALREADY_EXISTS',
  ConflictingState = 'CONFLICTING_STATE',
  RateLimited = 'RATE_LIMITED',
}

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export const isDomainError = (error: unknown): error is DomainError =>
  error instanceof DomainError;
