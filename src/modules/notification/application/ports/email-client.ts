export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailClient {
  sendEmail(options: SendEmailOptions): Promise<void>;
}
