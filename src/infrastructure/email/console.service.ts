import type { EmailOptions, EmailService } from '../../domain/email.js';

export class ConsoleEmailService implements EmailService {
  async sendEmail(options: EmailOptions): Promise<void> {
    console.log('--- Email Sent ---');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text: ${options.text}`);
    if (options.html) {
      console.log(`HTML: ${options.html}`);
    }
    console.log('------------------');
    return Promise.resolve();
  }
}
