import type { Express } from 'express';
import { databaseEnvProbe, initializeDatabase, usingRemoteDatabase } from './db';
import { createApiApplication, mountErrorHandler } from './apiApplication';
import { usingSupabaseMedia } from './mediaStore';

let appPromise: Promise<Express> | null = null;

/**
 * Lazy Express app for Vercel serverless. No listen(); static SPA is served from
 * dist/public via vercel.json. Requires Supabase Postgres (no PGlite).
 */
export function getVercelApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      if (process.env.TRUST_PROXY === undefined) process.env.TRUST_PROXY = 'true';
      if (process.env.COOKIE_SECURE === undefined) process.env.COOKIE_SECURE = 'true';
      const probe = databaseEnvProbe();
      if (!usingRemoteDatabase) {
        throw new Error(
          `Postgres URL required on Vercel (DATABASE_URL or POSTGRES_URL_NON_POOLING / POSTGRES_URL). Probe: databaseUrl=${probe.hasDatabaseUrl} postgresNonPooling=${probe.hasPostgresNonPooling} postgresUrl=${probe.hasPostgresUrl}`,
        );
      }
      if (!probe.sessionSecretOk) {
        throw new Error('SESSION_SECRET must be set on Vercel and at least 48 characters');
      }
      if (!usingSupabaseMedia) {
        console.warn('Supabase Storage env incomplete; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for media');
      }
      await initializeDatabase();
      const { app } = await createApiApplication();
      mountErrorHandler(app);
      return app;
    })().catch(error => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}
