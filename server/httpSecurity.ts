import type { Express, RequestHandler } from 'express';
import { distributedRateLimit } from './distributedRateLimit';
import { securityHeaders } from './securityHeaders';

// Browser mutations must originate from this app. CLI clients without browser
// origin headers still authenticate normally; no CORS access is granted.
export function mountHttpSecurity(app: Express) {
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use((req, res, next) => {
    res.set(securityHeaders(process.env.NODE_ENV === 'production', req.secure));
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    const expected = `${req.protocol}://${req.get('host')}`;
    const site = req.get('Sec-Fetch-Site');
    if ((site && !['same-origin', 'none'].includes(site)) || (origin && origin !== expected)) {
      return res.status(403).json({ message: 'Requests must come from this application' });
    }
    next();
  });
}

type Bucket = { count: number; reset: number };
let rateLimitScope = 0;
// Bounded, short-lived per-process buckets. Successful sign-ins release their
// account bucket; IP limits still apply to prevent many-account abuse.
export function rateLimit(limit: number, windowMs: number, key: (req: any) => string, skipSuccessful = false): RequestHandler {
  const scope = `${++rateLimitScope}:${limit}:${windowMs}`;
  if (process.env.CAFE_RUNTIME === 'workers') return distributedRateLimit(scope, limit, windowMs, key, skipSuccessful);
  const buckets = new Map<string, Bucket>();
  const cleanup = setInterval(() => { const now = Date.now(); buckets.forEach((b,k) => { if (b.reset <= now) buckets.delete(k); }); }, Math.min(windowMs, 60000));
  cleanup.unref();
  return (req, res, next) => {
    const now = Date.now(), id = key(req);
    let bucket = buckets.get(id);
    if (!bucket || bucket.reset <= now) {
      if (buckets.size >= 10000) return res.status(429).set('Retry-After', '60').json({ message: 'Too many requests. Try again shortly.' });
      bucket = { count: 0, reset: now + windowMs }; buckets.set(id, bucket);
    }
    if (++bucket.count > limit) return res.status(429).set('Retry-After', String(Math.ceil((bucket.reset - now) / 1000))).json({ message: 'Too many attempts. Try again shortly.' });
    if (skipSuccessful) res.once('finish', () => { if (res.statusCode < 400 && buckets.get(id) === bucket) buckets.delete(id); });
    next();
  };
}
