import { z } from 'zod';

export const EmailConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('smtp'),
    host: z.string(),
    port: z.coerce.number(),
    user: z.string().optional(),
    pass: z.string().optional(),
    secure: z.coerce.boolean().default(false),
    from: z.string(),
  }),
  z.object({
    type: z.literal('gmail'),
    user: z.email(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
]);

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

export const getEmailConfigFromEnv = () => {
  const type = process.env.EMAIL_TYPE;

  switch (type) {
    case 'smtp':
      return {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        secure: process.env.SMTP_SECURE === 'true',
        from: process.env.SMTP_FROM,
      };
    case 'gmail':
      return {
        type: 'gmail',
        user: process.env.GMAIL_USER_EMAIL,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      };
    default:
      throw Error('Unknown email config type detected!');
  }
};
