import { config } from 'dotenv';
config();
// Fill cloud vars (DATABASE_URL, Supabase storage) without overriding explicit .env values.
config({ path: '.env.cloud', quiet: true });

import * as schema from '@shared/schema';
import path from 'node:path';
import fs from 'node:fs';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/**
 * Resolve Postgres URL for local + Vercel.
 * Prefer DATABASE_URL when set. On Vercel Supabase integration, fall back to
 * POSTGRES_URL_NON_POOLING (direct / session-friendly — preferred for serverless
 * with Drizzle migrate + node-postgres) then POSTGRES_URL (often transaction pooler).
 */
function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

const databaseUrl = resolveDatabaseUrl();
const migrationsFolder = path.resolve('migrations');
const onVercel = process.env.VERCEL === '1';

// PGlite and node-postgres drizzle APIs match for this app; one type keeps callers simple.
export type AppDatabase = NodePgDatabase<typeof schema>;

export const usingRemoteDatabase = Boolean(databaseUrl);

if (!databaseUrl && onVercel) {
  throw new Error(
    'Postgres URL missing on Vercel. Set DATABASE_URL, or connect Supabase so POSTGRES_URL_NON_POOLING / POSTGRES_URL exist. PGlite is local-only.',
  );
}

let pool: { close(): Promise<void> };
let db: AppDatabase;
let initializeDatabase: () => Promise<void>;

if (databaseUrl) {
  const pgPool = new pg.Pool({
    connectionString: databaseUrl,
    // Serverless: keep the pool tiny so cold starts do not exhaust Supabase slots.
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: onVercel ? 5_000 : 30_000,
    connectionTimeoutMillis: 15_000,
  });
  const remote = drizzlePg(pgPool, { schema });
  pool = { close: () => pgPool.end() };
  db = remote;
  initializeDatabase = async () => {
    // Idempotent when __drizzle_migrations already matches; cloud DBs are usually pre-migrated.
    await migratePg(remote, { migrationsFolder });
  };
} else {
  // Dynamic import keeps @electric-sql/pglite out of the Vercel serverless graph.
  let localReady: Promise<void> | null = null;
  initializeDatabase = async () => {
    if (!localReady) {
      localReady = (async () => {
        const { PGlite } = await import('@electric-sql/pglite');
        const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
        const { migrate: migratePglite } = await import('drizzle-orm/pglite/migrator');
        const dataDir = path.resolve(process.env.DATA_DIR || 'data/database');
        fs.mkdirSync(path.dirname(dataDir), { recursive: true });
        const local = new PGlite(dataDir);
        const embedded = drizzlePglite(local, { schema });
        pool = local;
        db = embedded as unknown as AppDatabase;
        await migratePglite(embedded, { migrationsFolder });
      })();
    }
    await localReady;
  };
  // Placeholders until initializeDatabase(); ESM live bindings update importers after init.
  pool = { close: async () => {} };
  db = null as unknown as AppDatabase;
}

export { pool, db, initializeDatabase };
