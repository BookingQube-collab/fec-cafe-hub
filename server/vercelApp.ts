import type { Express } from 'express';
import { initializeDatabase, usingRemoteDatabase } from './db';
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
      if (!usingRemoteDatabase) {
        throw new Error('DATABASE_URL is required on Vercel (local PGlite is not supported in serverless)');
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
