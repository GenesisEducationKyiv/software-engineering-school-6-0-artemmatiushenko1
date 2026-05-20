import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export async function setup() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  dotenv.config({
    path: path.join(__dirname, '../../.env.test'),
    override: true,
  });

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../drizzle'),
  });
  await pool.end();
}
