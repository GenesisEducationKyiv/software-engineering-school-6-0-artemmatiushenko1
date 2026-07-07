import path from 'path';
import { fileURLToPath } from 'url';
import { is } from 'drizzle-orm/entity';
import type { MigrationConfig } from 'drizzle-orm/migrator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import type { Database } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

type ModuleMigrationConfig = {
  name: string;
  folder: string;
  migrationsTable: string;
};

const MODULE_MIGRATION_FOLDERS: ModuleMigrationConfig[] = [
  {
    name: 'platform',
    folder: path.join(projectRoot, 'src/platform/db/migrations'),
    migrationsTable: '__drizzle_migrations_platform',
  },
  {
    name: 'subscription',
    folder: path.join(
      projectRoot,
      'src/modules/subscription/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_subscription',
  },
  {
    name: 'scanner',
    folder: path.join(
      projectRoot,
      'src/modules/scanner/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_scanner',
  },
  {
    name: 'notification',
    folder: path.join(
      projectRoot,
      'src/modules/notification/infrastructure/db/migrations',
    ),
    migrationsTable: '__drizzle_migrations_notification',
  },
];

const isPgliteDatabase = (db: Database): db is PgliteDatabase => {
  return is(db, PgliteDatabase);
};

const isPostgresDatabase = (db: Database): db is NodePgDatabase => {
  return is(db, NodePgDatabase);
};

const runDatabaseMigrations = async (
  db: Database,
  config: MigrationConfig,
): Promise<void> => {
  if (isPgliteDatabase(db)) {
    await migratePglite(db, config);
    return;
  }

  if (isPostgresDatabase(db)) {
    await migrateNodePg(db, config);
    return;
  }

  throw new Error(
    `Unsupported database driver for migrations: ${db.constructor.name}`,
  );
};

export const runAllDatabaseMigrations = async (db: Database): Promise<void> => {
  for (const { folder, migrationsTable } of MODULE_MIGRATION_FOLDERS) {
    await runDatabaseMigrations(db, {
      migrationsFolder: folder,
      migrationsTable,
    });
  }
};
