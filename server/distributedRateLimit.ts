import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { workerContext, deferRequestTask } from './workerContext';

export function distributedRateLimit(scope: string, limit: number, windowMs: number, key: (req: any) => string, skipSuccessful: boolean): RequestHandler {
  return async (req, res, next) => {
    try {
      const { db } = workerContext();
      const id = createHash('sha256').update(`${scope}:${key(req)}`).digest('hex');
      const now = Date.now(), reset = new Date(now + windowMs);
      const result = await db.execute(sql`
        INSERT INTO rate_limit_buckets (id, count, reset_at) VALUES (${id}, 1, ${reset.toISOString()}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          count = CASE WHEN rate_limit_buckets.reset_at <= now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
          reset_at = CASE WHEN rate_limit_buckets.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit_buckets.reset_at END
        RETURNING count, extract(epoch from reset_at) * 1000 AS reset_ms`);
      const row = result.rows[0] as { count: number; reset_ms: string };
      if (row.count > limit) return res.status(429).set('Retry-After', String(Math.max(1, Math.ceil((Number(row.reset_ms) - now) / 1000)))).json({ message: 'Too many attempts. Try again shortly.' });
      if (skipSuccessful) res.once('finish', () => {
        if (res.statusCode < 400) deferRequestTask(db.execute(sql`DELETE FROM rate_limit_buckets WHERE id = ${id} AND reset_at = ${new Date(Number(row.reset_ms)).toISOString()}::timestamptz`));
      });
      next();
    } catch (error) { next(error); }
  };
}
