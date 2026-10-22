import type { Express, Request } from 'express';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { storage } from './storage';
import { isAuthenticated, isSuperAdmin } from './localAuth';
import { accessAudit, type AuthUser, type Restaurant, type User } from '@shared/schema';
import { deferRequestTask } from './requestTasks';

declare module 'express-session' {
  interface SessionData { userId: string; cafeId?: string }
}
export type CafeRequest = Request & { user: User; managedCafe?: Restaurant; managedCafeResolved?: boolean };

export async function getManagedCafe(req: any): Promise<Restaurant | undefined> {
  if (req.managedCafeResolved) return req.managedCafe;
  const cafe = req.user.role === 'super_admin'
    ? (req.session.cafeId ? await storage.getRestaurantById(req.session.cafeId) : undefined)
    : await storage.getRestaurantByUserId(req.user.id);
  req.managedCafe = cafe; req.managedCafeResolved = true;
  return cafe;
}
export async function mediaOwner(req: any): Promise<string> {
  return (await getManagedCafe(req))?.userId || req.user.id;
}
export async function authUser(req: any): Promise<AuthUser> {
  const { password, ...user } = req.user;
  const cafe = await getManagedCafe(req);
  const owner = cafe ? cafe.userId === req.user.id ? req.user : await storage.getUser(cafe.userId) : undefined;
  return { ...user, cafeContext: cafe ? { id: cafe.id, name: cafe.name, theme: cafe.theme,
    owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null } : null };
}

const publicGet = /^\/api\/(?:cafes$|(?:menu|restaurant|categories|menu-items)\/public\/[^/]+$|price-variants\/public\/(?:[^/]+|restaurant\/[^/]+)$)/;
const cafePath = /^\/api\/(?:restaurant|categories|menu-items|price-variants|manager-menu|category-order|cafe-backup|cafe-menu|objects\/upload)(?:\/|$)/;
const sharedPath = /^\/api\/(?:auth\/user|account\/password|menu-library)(?:\/|$)/;

export function mountAccessControl(app: Express) {
  // Every private API passes through one live role check. Public menu reads are explicit.
  app.use(async (req: any, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (['GET', 'HEAD'].includes(req.method) && publicGet.test(req.path)) return next();
    isAuthenticated(req, res, async (error?: any) => {
      if (error) return next(error);
      try {
        const actor: User = req.user;
        if (!['admin', 'super_admin'].includes(actor.role)) return res.status(403).json({ message: 'This account has no management role' });
        const requestPath = req.path;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          res.once('finish', () => {
            const candidate = req.platformCafe?.id || req.managedCafe?.id ||
              (requestPath === '/api/super-admin/cafe-access' ? req.session?.cafeId || req.body?.restaurantId : null) ||
              (requestPath.startsWith('/api/menu-library/') ? req.body?.restaurantId : null);
            const cafeId = typeof candidate === 'string' && z.string().uuid().safeParse(candidate).success ? candidate : null;
            deferRequestTask((async () => {
              const affected = req.platformCafe || req.managedCafe || (cafeId ? await storage.getRestaurantById(cafeId) : undefined);
              await db.insert(accessAudit).values({ actorId: actor.id, actorEmail: actor.email, actorRole: actor.role,
                cafeId, cafeName: affected?.name || null, action: `${req.method} ${requestPath}`, status: res.statusCode });
            })());
          });
        }
        if (requestPath.startsWith('/api/super-admin/')) {
          if (actor.role !== 'super_admin') return res.status(403).json({ message: 'Super admin access required' });
          return next();
        }
        if (sharedPath.test(requestPath)) return next();
        if (!cafePath.test(requestPath)) return res.status(404).json({ message: 'API route not found' });
        const cafe = await getManagedCafe(req);
        if (actor.role === 'super_admin' && !cafe) return res.status(409).json({ message: 'Open a café workspace from the platform dashboard first' });
        const expected = req.get('X-Cafe-Context');
        if ((expected && expected !== cafe?.id) || (actor.role === 'super_admin' && !['GET', 'HEAD'].includes(req.method) && expected !== cafe?.id)) {
          return res.status(409).json({ message: 'The café workspace changed. Reload before saving.' });
        }
        next();
      } catch (e) { next(e); }
    });
  });

  app.post('/api/super-admin/cafe-access', isSuperAdmin, async (req: any, res, next) => {
    try {
      const { restaurantId } = z.object({ restaurantId: z.string().uuid() }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(restaurantId);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      const owner = await storage.getUser(cafe.userId);
      if (!owner || !['admin','super_admin'].includes(owner.role)) return res.status(409).json({ message: 'This café needs a valid manager account' });
      req.session.cafeId = cafe.id;
      await new Promise<void>((resolve, reject) => req.session.save((err: Error) => err ? reject(err) : resolve()));
      req.managedCafe = cafe; req.managedCafeResolved = true;
      res.json(await authUser(req));
    } catch (e) { next(e); }
  });
  app.delete('/api/super-admin/cafe-access', isSuperAdmin, async (req: any, res, next) => {
    try {
      const previousId = req.session.cafeId;
      delete req.session.cafeId;
      await new Promise<void>((resolve, reject) => req.session.save((err: Error) => err ? reject(err) : resolve()));
      // Retain the affected café for the exit audit, then return the platform context.
      req.managedCafe = previousId ? await storage.getRestaurantById(previousId) : undefined;
      res.json({ success: true });
    } catch (e) { next(e); }
  });
  app.get('/api/super-admin/access-audit', isSuperAdmin, async (_req, res, next) => {
    try { res.json(await db.select().from(accessAudit).orderBy(desc(accessAudit.createdAt)).limit(200)); }
    catch (e) { next(e); }
  });
}
