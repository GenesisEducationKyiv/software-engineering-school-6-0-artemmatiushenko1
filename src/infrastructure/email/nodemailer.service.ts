import nodemailer from 'nodemailer';
import type { EmailOptions, EmailService } from '../../domain/email.js';

export interface NodemailerConfig {
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter;
  private user: string;

  constructor(config: NodemailerConfig) {
    this.user = config.user;
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
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.user,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
