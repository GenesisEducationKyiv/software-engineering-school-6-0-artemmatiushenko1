import type { PgDatabase, PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from './schema.js';

type SupportedQueryResultHKT = NodePgQueryResultHKT | PgliteQueryResultHKT;

export type Database = PgDatabase<SupportedQueryResultHKT, typeof schema>;

export type Transaction = PgTransaction<
  SupportedQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
