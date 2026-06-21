import z from 'zod';
import { InvalidEmailError } from './errors.js';

export class Email {
  private constructor(public readonly email: string) {
    Object.freeze(this);
  }

  static fromString(email: string): Email {
    const isValid = z.email().trim().toLowerCase().safeParse(email);
    if (!isValid.success) throw new InvalidEmailError(email);
    return new Email(isValid.data);
  }

  equals(other: Email): boolean {
    return this.email === other.email;
  }
}
