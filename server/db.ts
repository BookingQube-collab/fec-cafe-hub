import { config } from 'dotenv';
config();
// Fill cloud vars (DATABASE_URL, Supabase storage) without overriding explicit .env values.
config({ path: '.env.cloud', quiet: true });

import * as schema from '@shared/schema';
import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL?.trim();
const migrationsFolder = path.resolve('migrations');

// PGlite and node-postgres drizzle APIs match for this app; one type keeps callers simple.
export type AppDatabase = NodePgDatabase<typeof schema>;

export const usingRemoteDatabase = Boolean(databaseUrl);

let pool: { close(): Promise<void> };
let db: AppDatabase;
let initializeDatabase: () => Promise<void>;

if (databaseUrl) {
  const pgPool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 15000,
  });
  const remote = drizzlePg(pgPool, { schema });
  pool = { close: () => pgPool.end() };
  db = remote;
  initializeDatabase = async () => {
    // Idempotent when __drizzle_migrations already matches; cloud DBs are usually pre-migrated.
    await migratePg(remote, { migrationsFolder });
  };
} else {
  const dataDir = path.resolve(process.env.DATA_DIR || 'data/database');
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const local = new PGlite(dataDir);
  const embedded = drizzlePglite(local, { schema });
  pool = local;
  db = embedded as unknown as AppDatabase;
  initializeDatabase = async () => {
    await migratePglite(embedded, { migrationsFolder });
  };
}

export { pool, db, initializeDatabase };
