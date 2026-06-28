import { describe, it, expect } from 'vitest';
import { Email } from './index.js';
import { Recipient } from './recipient.js';

describe('Recipient', () => {
  it('creates with email and unsubscribe token', () => {
    const recipient = Recipient.create(
      'sub-1',
      Email.fromString('alice@example.com'),
      'unsub-token',
    );

    expect(recipient.subscriptionId).toBe('sub-1');
    expect(recipient.email.value).toBe('alice@example.com');
    expect(recipient.unsubscribeToken).toBe('unsub-token');
  });

  it('rehydrates from persistence', () => {
    const recipient = Recipient.rehydrate({
      subscriptionId: 'sub-1',
      email: Email.fromString('alice@example.com'),
      unsubscribeToken: 'unsub-token',
    });

    expect(recipient.subscriptionId).toBe('sub-1');
    expect(recipient.email.value).toBe('alice@example.com');
    expect(recipient.unsubscribeToken).toBe('unsub-token');
  });
});
