import { eq } from 'drizzle-orm';
import { processedDeliveries } from '../db/schema.js';
import type { Database } from '../db/types.js';
import type { DeliveryClaim, DeliveryDedup } from './delivery-dedup.js';

export class DrizzleDeliveryDedup implements DeliveryDedup {
  constructor(private readonly db: Database) {}

  async claim(id?: string): Promise<DeliveryClaim | null> {
    if (!id) {
      return { release: async () => {} };
    }

    const [row] = await this.db
      .insert(processedDeliveries)
      .values({ id })
      .onConflictDoNothing()
      .returning({ id: processedDeliveries.id });

    if (!row) {
      return null;
    }

    return {
      release: async () => {
        await this.db
          .delete(processedDeliveries)
          .where(eq(processedDeliveries.id, id));
      },
    };
  }
}
