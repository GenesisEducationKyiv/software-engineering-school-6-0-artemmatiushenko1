import { eq } from 'drizzle-orm';
import { processedDeliveries } from '../db/schema.js';
import type { Database } from '../db/types.js';
import type { IdempotencyGuard } from './idempotency-guard.js';

export class DrizzleIdempotencyGuard implements IdempotencyGuard {
  constructor(private readonly db: Database) {}

  async isProcessed(key: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: processedDeliveries.id })
      .from(processedDeliveries)
      .where(eq(processedDeliveries.id, key))
      .limit(1);

    return row !== undefined;
  }

  async markProcessed(key: string): Promise<void> {
    await this.db
      .insert(processedDeliveries)
      .values({ id: key })
      .onConflictDoNothing();
  }
}
