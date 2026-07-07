import type { PgDatabase, PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

type SupportedQueryResultHKT = NodePgQueryResultHKT | PgliteQueryResultHKT;

// ponytail: platform must not enumerate module tables, so the schema type param
// is left open. Repositories use db.select().from(table) / db.insert(table),
// which need no schema type. The relational db.query.* API (which does need it)
// is only used in tests, which supply the concrete schema via Database<typeof schema>.
export type Database<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = PgDatabase<SupportedQueryResultHKT, TSchema>;

export type Transaction = PgTransaction<
  SupportedQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;
