import { z } from 'zod';

export const ScannerConfigSchema = z.object({
  cronExpression: z.string().default('*/10 * * * *'), // Default to every 10 minutes
});

export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

export const getScannerConfigFromEnv = () => ({
  cronExpression: process.env.SCANNER_CRON,
});
