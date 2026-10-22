import type { IncomingMessage, ServerResponse } from 'node:http';
import { getVercelApp } from '../server/vercelApp';

/**
 * Single serverless entry for /api/* and /objects/* (see vercel.json rewrites).
 * Sessions stay DB-backed; cookies use COOKIE_SECURE + TRUST_PROXY on Vercel.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getVercelApp();
  return app(req, res);
}
