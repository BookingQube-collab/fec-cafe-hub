import { config } from 'dotenv';
config();
// Fill cloud vars (DATABASE_URL, Supabase storage) without overriding explicit .env values.
config({ path: '.env.cloud', quiet: true });

import * as schema from '@shared/schema';
import path from 'node:path';
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

function resolveMigrationsFolder() {
  // cwd is correct locally and on Vercel when includeFiles copies migrations/** into the function.
  return path.resolve(process.cwd(), 'migrations');
}

const databaseUrl = resolveDatabaseUrl();
const migrationsFolder = resolveMigrationsFolder();
const onVercel = process.env.VERCEL === '1';

// PGlite and node-postgres drizzle APIs match for this app; one type keeps callers simple.
export type AppDatabase = NodePgDatabase<typeof schema>;

export const usingRemoteDatabase = Boolean(databaseUrl);

let pool: { close(): Promise<void> };
let db: AppDatabase;
let initializeDatabase: () => Promise<void>;

if (databaseUrl) {
  // Supabase and most managed Postgres require TLS; node-pg does not always infer from the URL alone.
  const ssl =
    onVercel || /supabase\.co|sslmode=require/i.test(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined;
  const pgPool = new pg.Pool({
    connectionString: databaseUrl,
    ssl,
    // Serverless: keep the pool tiny so cold starts do not exhaust Supabase slots.
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: onVercel ? 5_000 : 30_000,
    connectionTimeoutMillis: 15_000,
  });
  const remote = drizzlePg(pgPool, { schema });
  pool = { close: () => pgPool.end() };
  db = remote;
  initializeDatabase = async () => {
    // Verify connectivity first so boot failures are actionable in function logs.
    await pgPool.query('select 1');
    // Cold-start migrate against a transaction pooler is fragile. Default off on Vercel;
    // run `npm run db:migrate` (or set RUN_MIGRATE_ON_BOOT=true) when schema changes.
    const runMigrate = !onVercel || process.env.RUN_MIGRATE_ON_BOOT === 'true';
    if (!runMigrate) return;
    try {
      await migratePg(remote, { migrationsFolder });
    } catch (error) {
      console.error('Drizzle migrate failed on boot', {
        type: (error as Error)?.name,
        message: (error as Error)?.message,
        migrationsFolder,
      });
      throw error;
    }
  };
} else {
  // Hide the specifier from static tracers so @electric-sql/pglite stays out of the Vercel graph.
  let localReady: Promise<void> | null = null;
  initializeDatabase = async () => {
    if (onVercel) {
      throw new Error(
        'Postgres URL missing on Vercel. Set DATABASE_URL, or connect Supabase so POSTGRES_URL_NON_POOLING / POSTGRES_URL exist. PGlite is local-only.',
      );
    }
    if (!localReady) {
      localReady = (async () => {
        const localModule = ['./dbPglite', ''].join('');
        const { initPgliteDatabase } = await import(localModule);
        const local = await initPgliteDatabase(migrationsFolder);
        pool = local.pool;
        db = local.db as unknown as AppDatabase;
      })();
    }
    await localReady;
  };
  // Placeholders until initializeDatabase(); ESM live bindings update importers after init.
  pool = { close: async () => {} };
  db = null as unknown as AppDatabase;
}

export { pool, db, initializeDatabase };

/** Safe for /api/healthz — never logs secret values. */
export function databaseEnvProbe() {
  return {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL?.trim()),
    hasPostgresNonPooling: Boolean(process.env.POSTGRES_URL_NON_POOLING?.trim()),
    usingRemoteDatabase,
    sessionSecretOk: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 48),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    publicUrl: process.env.PUBLIC_URL?.trim() || null,
  };
}
