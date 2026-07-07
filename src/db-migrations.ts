import path from 'path';
import { fileURLToPath } from 'url';
import type { MigrationModuleConfig } from './platform/db/migrate.js';

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const migrationModules: MigrationModuleConfig[] = [
  {
    folder: path.join(projectRoot, 'src/platform/db/migrations'),
    migrationsTable: '__drizzle_migrations_platform',
  },
  {
    folder: path.join(
      projectRoot,
      'src/modules/subscription/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_subscription',
  },
  {
    folder: path.join(
      projectRoot,
      'src/modules/scanner/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_scanner',
  },
  {
    folder: path.join(
      projectRoot,
      'src/modules/notification/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_notification',
  },
];
