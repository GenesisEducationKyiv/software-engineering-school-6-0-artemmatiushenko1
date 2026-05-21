import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { createConfig } from '../config.js';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

const config = createConfig();

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export type Transaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
