import { db } from '../../../src/platform/db/client.js';
import * as schema from '../../../src/platform/db/schema.js';

export const resetTestData = async () => {
  await db.delete(schema.repoWatchers);
  await db.delete(schema.monitoredRepos);
  await db.delete(schema.notificationRecipients);
  await db.delete(schema.subscriptions);
  await db.delete(schema.outboxMessages);
  await db.delete(schema.processedDeliveries);
};
