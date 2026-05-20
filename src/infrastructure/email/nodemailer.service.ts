import nodemailer from 'nodemailer';
import type { EmailOptions, EmailService } from '../../domain/email.js';
import type { EmailConfig } from '../../config.js';

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: EmailConfig) {
    if (config.type === 'gmail') {
      this.from = config.user;
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: config.user,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          refreshToken: config.refreshToken,
        },
      });
    } else {
      // SMTP
      this.from = config.from;
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth:
          config.user && config.pass
            ? {
                user: config.user,
                pass: config.pass,
              }
            : undefined,
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
