import type { Email } from '../../../shared-kernel/index.js';

export type RecipientParams = {
  subscriptionId: string;
  email: Email;
  unsubscribeToken: string;
};

export class Recipient {
  readonly subscriptionId: string;
  private _email: Email;
  private _unsubscribeToken: string;

  private constructor(params: RecipientParams) {
    this.subscriptionId = params.subscriptionId;
    this._email = params.email;
    this._unsubscribeToken = params.unsubscribeToken;
  }

  static create(
    subscriptionId: string,
    email: Email,
    unsubscribeToken: string,
  ): Recipient {
    return new Recipient({
      subscriptionId,
      email,
      unsubscribeToken,
    });
  }

  static rehydrate(params: RecipientParams): Recipient {
    return new Recipient(params);
  }

  get email(): Email {
    return this._email;
  }

  get unsubscribeToken(): string {
    return this._unsubscribeToken;
  }
}
