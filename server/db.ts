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
 * True when the URL is Supabase/PgBouncer session pooler (port 5432 on *.pooler.*).
 * Session mode caps ~15 clients — fatal under Vercel concurrency (EMAXCONNSESSION).
 */
function isSessionPoolerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:' ? '5432' : '');
    return host.includes('pooler') && port === '5432';
  } catch {
    return false;
  }
}

/** Transaction pooler (Supavisor :6543 or ?pgbouncer=true) — correct for serverless. */
function isTransactionPoolerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const port = parsed.port;
    if (port === '6543') return true;
    return parsed.searchParams.get('pgbouncer') === 'true';
  } catch {
    return /[?&]pgbouncer=true\b/i.test(url) || /:6543(?:\/|$|\?)/.test(url);
  }
}

/**
 * Rewrite Supabase session pooler (:5432 on *.pooler.*) → transaction (:6543 + pgbouncer).
 * Needed when POSTGRES_URL_NON_POOLING is IPv4/"direct" via session pooler (EMAXCONNSESSION).
 */
function sessionPoolerToTransaction(url: string): string | undefined {
  if (!isSessionPoolerUrl(url)) return undefined;
  try {
    const parsed = new URL(url);
    parsed.port = '6543';
    parsed.searchParams.set('pgbouncer', 'true');
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Resolve Postgres URL for local + Vercel.
 * Prefer DATABASE_URL when set.
 * On Vercel (migrate-on-boot off): prefer transaction pooler so concurrent lambdas
 * do not exhaust session-mode slots (EMAXCONNSESSION / pool_size ≈ 15).
 * Local / migrate-on-boot: prefer POSTGRES_URL_NON_POOLING (direct) then POSTGRES_URL.
 */
function resolveDatabaseUrl(): string | undefined {
  const onVercel = process.env.VERCEL === '1';
  const migrateOnBoot = process.env.RUN_MIGRATE_ON_BOOT === 'true';
  const preferTransactionPooler = onVercel && !migrateOnBoot;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const postgresUrl = process.env.POSTGRES_URL?.trim();
  const nonPooling = process.env.POSTGRES_URL_NON_POOLING?.trim();

  if (preferTransactionPooler) {
    const candidates = [databaseUrl, postgresUrl, nonPooling].filter((v): v is string => Boolean(v));
    if (!candidates.length) return undefined;

    // Explicit non-session DATABASE_URL wins.
    if (databaseUrl && !isSessionPoolerUrl(databaseUrl) && !isTransactionPoolerUrl(databaseUrl)) {
      return normalizePostgresUrl(databaseUrl);
    }
    if (databaseUrl && isTransactionPoolerUrl(databaseUrl)) {
      return normalizePostgresUrl(databaseUrl);
    }

    const transaction = candidates.find(isTransactionPoolerUrl);
    if (transaction) return normalizePostgresUrl(transaction);

    for (const candidate of candidates) {
      const rewritten = sessionPoolerToTransaction(candidate);
      if (rewritten) return normalizePostgresUrl(rewritten);
    }

    const nonSession = candidates.find((u) => !isSessionPoolerUrl(u));
    return normalizePostgresUrl(nonSession || candidates[0]);
  }

  for (const value of [databaseUrl, nonPooling, postgresUrl]) {
    if (value) return normalizePostgresUrl(value);
  }
  return undefined;
}

function describePoolerMode(url: string | undefined): 'transaction' | 'session' | 'direct' | null {
  if (!url) return null;
  if (isTransactionPoolerUrl(url)) return 'transaction';
  if (isSessionPoolerUrl(url)) return 'session';
  return 'direct';
}

/**
 * node-pg v8+ maps sslmode=require → verify-full, which breaks Supabase on Vercel
 * (SELF_SIGNED_CERT_IN_CHAIN) even when Pool.ssl.rejectUnauthorized is false.
 * uselibpqcompat restores libpq's require = encrypt without full CA verify.
 */
function normalizePostgresUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('uselibpqcompat')) parsed.searchParams.set('uselibpqcompat', 'true');
    if (!parsed.searchParams.get('sslmode')) parsed.searchParams.set('sslmode', 'require');
    return parsed.toString();
  } catch {
    return url;
  }
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
    // Serverless: one client per isolate; release idle sockets quickly so Supavisor slots free up.
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: onVercel ? 1_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: onVercel,
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
    poolerMode: describePoolerMode(databaseUrl),
    sessionSecretOk: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 48),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    publicUrl: process.env.PUBLIC_URL?.trim() || null,
  };
}
