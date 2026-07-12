import { InvalidEmailError } from './errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  static fromString(email: string): Email {
    if (!EMAIL_REGEX.test(email)) {
      throw new InvalidEmailError(email);
    }

    return new Email(email.trim().toLowerCase());
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
