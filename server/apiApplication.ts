import express, { type Request, type Response, type NextFunction } from 'express';
import { registerRoutes } from './routes';
import { mountHttpSecurity } from './httpSecurity';

export async function createApiApplication() {
  const app = express();
  mountHttpSecurity(app);
  const json = express.json({ limit: '1mb' });
  app.use((req, res, next) => req.path.startsWith('/objects/') ? next() : json(req, res, next));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(req.method) &&
      (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ message: 'Send a JSON object' });
    next();
  });
  const server = await registerRoutes(app);
  return { app, server };
}

export function mountErrorHandler(app: express.Express) {
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const databaseCode = err.code || err.cause?.code;
    const constraintStatus = databaseCode === '23505' || databaseCode === '23503' ? 409 : databaseCode === '23514' ? 400 : undefined;
    const rawStatus = constraintStatus || (err.name === 'ZodError' ? 400 : (err.status || err.statusCode || 500));
    const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
    const message = constraintStatus ? 'This record conflicts with the latest saved data. Refresh and try again.' : status >= 500 ? 'Unable to complete this request' : err.name === 'ZodError' ? err.issues.map((i: any) => i.message).join(', ') : status === 413 ? 'This request is too large' : err.type === 'entity.parse.failed' ? 'Invalid JSON request' : err.message || 'Request failed';
    if (status >= 500) console.error('Request failed', { type: err.name, code: databaseCode });
    res.status(status).json({ message });
  });
}
