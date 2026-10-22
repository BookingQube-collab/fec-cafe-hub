import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Single serverless entry for /api/* and /objects/* (see vercel.json rewrites).
 * Lazy-import the app so /api/healthz still works when boot fails, and so import-time
 * crashes surface as JSON instead of opaque FUNCTION_INVOCATION_FAILED when possible.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  const pathOnly = url.split('?')[0];

  if (pathOnly === '/api/healthz' || pathOnly === '/healthz') {
    try {
      const { databaseEnvProbe } = await import('../server/db');
      const probe = databaseEnvProbe();
      res.statusCode = probe.usingRemoteDatabase && probe.sessionSecretOk ? 200 : 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({ ok: res.statusCode === 200, ...probe }));
    } catch (error) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: false,
        message: 'Health probe failed to load',
        detail: error instanceof Error ? error.message : String(error),
      }));
    }
    return;
  }

  try {
    const { getVercelApp } = await import('../server/vercelApp');
    const app = await getVercelApp();
    return app(req, res);
  } catch (error) {
    console.error('Vercel API boot failed', error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({
        message: 'API failed to start',
        detail: error instanceof Error ? error.message : String(error),
      }));
    }
  }
}
