import { is } from 'drizzle-orm/entity';
import type { MigrationConfig } from 'drizzle-orm/migrator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import type { Database } from './types.js';

export type MigrationModuleConfig = {
  folder: string;
  migrationsTable: string;
};

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

export const runAllDatabaseMigrations = async (
  db: Database,
  modules: MigrationModuleConfig[],
): Promise<void> => {
  for (const { folder, migrationsTable } of modules) {
    await runDatabaseMigrations(db, {
      migrationsFolder: folder,
      migrationsTable,
    });
  }
};
