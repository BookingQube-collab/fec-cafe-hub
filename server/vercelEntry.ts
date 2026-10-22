import type { IncomingMessage, ServerResponse } from 'node:http';
import { databaseEnvProbe } from './db';
import { getVercelApp } from './vercelApp';

/**
 * Bundled by `npm run build` into api/index.js for Vercel.
 * A single file avoids ESM extensionless import failures under /var/task.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  const pathOnly = url.split('?')[0];

  if (pathOnly === '/api/healthz' || pathOnly === '/healthz') {
    const probe = databaseEnvProbe();
    res.statusCode = probe.usingRemoteDatabase && probe.sessionSecretOk ? 200 : 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ ok: res.statusCode === 200, ...probe }));
    return;
  }

  try {
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
