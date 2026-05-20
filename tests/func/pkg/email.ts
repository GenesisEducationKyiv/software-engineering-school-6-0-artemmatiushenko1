import type { EmailService, EmailOptions } from '../../../src/domain/email.js';

export class InMemoryEmailService implements EmailService {
  public sent: EmailOptions[] = [];

  async sendEmail(options: EmailOptions): Promise<void> {
    this.sent.push(options);
  }

  reset(): void {
    this.sent = [];
  }
}
