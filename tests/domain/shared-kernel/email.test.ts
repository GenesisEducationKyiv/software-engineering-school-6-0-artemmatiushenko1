import { describe, it, expect } from 'vitest';
import { Email, InvalidEmailError } from '../../../src/shared-kernel/index.js';

describe('Email', () => {
  describe('fromString', () => {
    it('should create an Email for a valid address', () => {
      const email = Email.fromString('test@example.com');

      expect(email.value).toBe('test@example.com');
    });

    it('should normalize email to lowercase', () => {
      const email = Email.fromString('Test@Example.COM');

      expect(email.value).toBe('test@example.com');
    });

    it.each([
      'user.name+tag@example.co.uk',
      'a@b.co',
      'user@sub.domain.example.com',
    ])('should accept valid email: %s', (address) => {
      const email = Email.fromString(address);

      expect(email.value).toBe(address);
    });

    it.each([
      'invalid-email',
      '',
      'missing@',
      '@missing.com',
      'spaces @example.com',
      '  test@example.com  ',
      ' test@example.com',
    ])('should throw InvalidEmailError for invalid email: %s', (address) => {
      expect(() => Email.fromString(address)).toThrow(InvalidEmailError);
      expect(() => Email.fromString(address)).toThrow(
        `Invalid email format: ${address}`,
      );
    });
  });

  describe('equals', () => {
    it('should return true for emails with the same address', () => {
      const first = Email.fromString('test@example.com');
      const second = Email.fromString('test@example.com');

      expect(first.equals(second)).toBe(true);
    });

    it('should return true for emails that normalize to the same address', () => {
      const first = Email.fromString('Test@Example.com');
      const second = Email.fromString('test@example.com');

      expect(first.equals(second)).toBe(true);
    });

    it('should return false for emails with different addresses', () => {
      const first = Email.fromString('first@example.com');
      const second = Email.fromString('second@example.com');

      expect(first.equals(second)).toBe(false);
    });
  });

  it('should be immutable', () => {
    const email = Email.fromString('test@example.com');

    expect(Object.isFrozen(email)).toBe(true);
  });
});
