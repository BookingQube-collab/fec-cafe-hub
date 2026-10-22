import type { Express } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from './passwords';
import { db } from './db';
import { storage } from './storage';
import { isSuperAdmin } from './localAuth';
import { ObjectStorageService, signedUploadURL } from './localObjects';
import { rateLimit } from './httpSecurity';
import { categories, menuItems, restaurants, sessions, users, insertCategorySchema, insertMenuItemSchema, cafeProfileSchema, passwordSchema, emailSchema } from '@shared/schema';

const profileSchema = cafeProfileSchema.partial().extend({
  name: z.string().trim().min(1).max(150).optional(), theme: z.enum(['e3','forest','terracotta','ocean','plum']).optional(),
  currency: z.enum(['SAR','QAR','INR','AED','USD','EUR','GBP']).optional(),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }).optional(),
  status: z.enum(['active','suspended','pending']).optional(), hidden: z.boolean().optional(),
}).strict();
const media = new ObjectStorageService();
async function mediaForCafe(url: string, cafeOwner: string, actorId: string) {
  try { return await media.trySetObjectEntityAclPolicy(url, { owner: cafeOwner, visibility: 'public' }); }
  catch {
    await media.trySetObjectEntityAclPolicy(url, { owner: actorId, visibility: 'public' });
    return media.copyForOwner(url, cafeOwner);
  }
}

export function mountPlatformControls(app: Express) {
  const credentialLimit = rateLimit(30, 60 * 60 * 1000, req => (req as any).user.id);
  app.use((req, res, next) => {
    const provisioning = req.method === 'POST' && /^\/api\/super-admin\/(users|restaurants)$/.test(req.path);
    const passwordChange = req.method === 'PUT' && (/^\/api\/super-admin\/restaurants\/[^/]+\/password$/.test(req.path) || /^\/api\/super-admin\/users\/[^/]+$/.test(req.path) && req.body?.password !== undefined);
    return provisioning || passwordChange ? credentialLimit(req, res, next) : next();
  });
  app.post('/api/super-admin/users', isSuperAdmin, async (req: any, res, next) => {
    try {
      const input = z.object({ email: emailSchema, password: passwordSchema, firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100), role: z.enum(['admin','super_admin']),
        restaurantName: z.string().trim().min(1).max(150).optional(),
      }).strict().refine(v => v.role === 'super_admin' ? !v.restaurantName : !!v.restaurantName,
        'Café managers need a restaurant name; super admins do not.').parse(req.body);
      const password = await bcrypt.hash(input.password, 12);
      const result = await db.transaction(async tx => {
        const [created] = await tx.insert(users).values({ email: input.email, password, firstName: input.firstName, lastName: input.lastName, role: input.role }).returning();
        let cafe;
        if (input.role === 'admin') [cafe] = await tx.insert(restaurants).values({ userId: created.id, name: input.restaurantName! }).returning();
        const { password: hidden, ...user } = created;
        return { user, cafe };
      });
      req.platformCafe = result.cafe;
      res.status(201).json(result);
    } catch (e: any) {
      if (e.code === '23505' || e.cause?.code === '23505') return res.status(409).json({ message: 'An account with this email already exists, including deleted accounts.' });
      next(e);
    }
  });
  // Recoverable account removal preserves café IDs, photos, menus and printed QRs.
  const changeAccountStatus = (accountStatus: 'active'|'frozen'|'deleted', restore = false) => async (req: any, res: any, next: any) => {
    try {
      if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: 'Choose a valid account' });
      const result = await db.transaction(async tx => {
        const platformAdmins = await tx.select().from(users).where(eq(users.role, 'super_admin')).orderBy(users.id).for('update');
        const [target] = await tx.select().from(users).where(eq(users.id, req.params.id)).for('update');
        if (!target) return { error: 'Account not found', status: 404 };
        if (accountStatus !== 'active' && target.id === req.user.id) return { error: 'You cannot freeze or delete your own account', status: 400 };
        if (accountStatus !== 'active' && target.role === 'super_admin' && target.accountStatus === 'active' && platformAdmins.filter(u => u.accountStatus === 'active').length <= 1)
          return { error: 'Keep at least one active super admin account', status: 400 };
        if (target.accountStatus === 'deleted' && accountStatus !== 'deleted' && !restore) return { error: 'Restore this deleted account first', status: 409 };
        if (restore && target.accountStatus !== 'deleted') return { error: 'Only deleted accounts can be restored', status: 409 };
        const [updated] = await tx.update(users).set({ accountStatus, updatedAt: new Date() }).where(eq(users.id, target.id)).returning();
        // Revokes every current session; auth also checks live account status on every request.
        await tx.delete(sessions).where(sql`${sessions.sess}->>'userId' = ${target.id}`);
        const { password: hidden, ...user } = updated;
        return { user };
      });
      if ('error' in result) return res.status(result.status!).json({ message: result.error });
      req.platformCafe = await storage.getRestaurantByUserId(req.params.id);
      res.json(result.user);
    } catch (e) { next(e); }
  };
  app.post('/api/super-admin/users/:id/freeze', isSuperAdmin, changeAccountStatus('frozen'));
  app.post('/api/super-admin/users/:id/unfreeze', isSuperAdmin, changeAccountStatus('active'));
  app.delete('/api/super-admin/users/:id', isSuperAdmin, changeAccountStatus('deleted'));
  app.post('/api/super-admin/users/:id/restore', isSuperAdmin, changeAccountStatus('active', true));
  app.use(async (req: any, res, next) => {
    const match = req.path.match(/^\/api\/super-admin\/restaurants\/([^/]+)(?:\/|$)/);
    try {
      let cafeId = match?.[1];
      if (!cafeId && ['PUT','DELETE'].includes(req.method)) {
        const categoryMatch = req.path.match(/^\/api\/super-admin\/categories\/([^/]+)$/);
        const itemMatch = req.path.match(/^\/api\/super-admin\/menu-items\/([^/]+)$/);
        if (categoryMatch) { const [cat] = await db.select().from(categories).where(eq(categories.id, categoryMatch[1])); cafeId = cat?.restaurantId; }
        if (itemMatch) { const [row] = await db.select({ cafeId: categories.restaurantId }).from(menuItems).innerJoin(categories, eq(menuItems.categoryId, categories.id)).where(eq(menuItems.id, itemMatch[1])); cafeId = row?.cafeId; }
        if ((categoryMatch || itemMatch) && !cafeId) return res.status(404).json({ message: 'Item not found' });
      }
      if (!cafeId) return next();
      const cafe = await storage.getRestaurantById(cafeId);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      req.platformCafe = cafe; next();
    } catch (e) { next(e); }
  });
  app.post('/api/super-admin/restaurants/:id/upload', isSuperAdmin, rateLimit(100, 60 * 60 * 1000, req => (req as any).user.id), async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      res.json({ uploadURL: signedUploadURL(cafe.userId, (req as any).user) });
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/users/:id', isSuperAdmin, async (req: any, res, next) => {
    try {
      const data = z.object({ email: emailSchema.optional(), firstName: z.string().trim().max(100).nullable().optional(),
        lastName: z.string().trim().max(100).nullable().optional(), role: z.enum(['admin','super_admin']).optional(), password: passwordSchema.optional() }).strict().refine(v => Object.keys(v).length > 0, 'Choose an account field to update').parse(req.body);
      const password = data.password ? await bcrypt.hash(data.password, 12) : undefined;
      const result = await db.transaction(async tx => {
        // Serialize role changes, including concurrent attempts to remove the last platform admin.
        const superAdmins = await tx.select().from(users).where(eq(users.role, 'super_admin')).orderBy(users.id).for('update');
        const [target] = await tx.select().from(users).where(eq(users.id, req.params.id)).for('update');
        if (!target) return { error: 'Account not found', status: 404 };
        if (target.accountStatus === 'deleted') return { error: 'Restore this deleted account before editing it', status: 409 };
        if (data.email && (await tx.select().from(users).where(and(sql`lower(${users.email}) = ${data.email}`, sql`${users.id} <> ${target.id}`))).length) return { error: 'An account with this email already exists', status: 409 };
        if (target.role === 'super_admin' && target.accountStatus === 'active' && data.role === 'admin' && superAdmins.filter(u => u.accountStatus === 'active').length <= 1) return { error: 'Keep at least one active super admin account', status: 400 };
        const [updated] = await tx.update(users).set({ ...data, ...(password ? { password } : {}), updatedAt: new Date() }).where(eq(users.id, target.id)).returning();
        if (password || (data.role && data.role !== target.role)) await tx.delete(sessions).where(sql`${sessions.sess}->>'userId' = ${target.id}`);
        const { password: hidden, ...safe } = updated;
        return { user: safe };
      });
      if ('error' in result) return res.status(result.status!).json({ message: result.error });
      res.json(result.user);
    } catch (e: any) {
      if (e.code === '23505' || e.cause?.code === '23505') return res.status(409).json({ message: 'An account with this email already exists' });
      next(e);
    }
  });

  app.put('/api/super-admin/restaurants/:id', isSuperAdmin, async (req: any, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      const data = profileSchema.parse(req.body);
      for (const key of ['logoUrl','coverMediaUrl'] as const) if (data[key]) {
        const kind = await media.mediaType(data[key]!, key !== 'coverMediaUrl');
        data[key] = await mediaForCafe(data[key]!, cafe.userId, req.user.id);
        if (key === 'coverMediaUrl') data.coverMediaType = kind;
      }
      if ('coverMediaUrl' in data && !data.coverMediaUrl) data.coverMediaType = null;
      res.json(await storage.updateRestaurant(cafe.id, data));
    } catch (e) { next(e); }
  });
  app.delete('/api/super-admin/restaurants/:id', isSuperAdmin, async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      await db.transaction(async tx => {
        await tx.delete(restaurants).where(eq(restaurants.id, cafe.id));
        // A café deletion must never delete a platform administrator account.
        const [owner] = await tx.select().from(users).where(eq(users.id, cafe.userId));
        if (owner?.role === 'admin') await tx.delete(sessions).where(sql`${sessions.sess}->>'userId' = ${cafe.userId}`);
        await tx.delete(users).where(and(eq(users.id, cafe.userId), eq(users.role, 'admin')));
      });
      res.json({ success: true });
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/restaurants/:id/password', isSuperAdmin, async (req, res, next) => {
    try {
      const { newPassword } = z.object({ newPassword: passwordSchema }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      const password = await bcrypt.hash(newPassword, 12);
      await db.transaction(async tx => {
        await tx.update(users).set({ password, updatedAt: new Date() }).where(eq(users.id, cafe.userId));
        await tx.delete(sessions).where(sql`${sessions.sess}->>'userId' = ${cafe.userId}`);
      });
      res.json({ success: true, message: 'Manager password reset. Previous sessions signed out.' });
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/restaurants/:id/cover-media', isSuperAdmin, async (req: any, res, next) => {
    try {
      const data = z.object({ coverMediaUrl: z.string(), coverMediaType: z.enum(['image','video','gif']).nullable() }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      const url = data.coverMediaUrl ? await mediaForCafe(data.coverMediaUrl.split('?')[0], cafe.userId, req.user.id) : null;
      const kind = url ? await media.mediaType(url) : null;
      await storage.updateRestaurant(cafe.id, { coverMediaUrl: url, coverMediaType: kind });
      res.json({ objectPath: url, coverMediaType: kind });
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/restaurants/:id/profile', isSuperAdmin, async (req: any, res, next) => {
    try {
      const data = cafeProfileSchema.pick({ name: true, cuisineType: true, address: true, phone: true, openingHours: true }).partial().parse(req.body);
      if (!Object.keys(data).length) return res.status(400).json({ message: 'Choose a profile field to update' });
      res.json(await storage.updateRestaurant(req.platformCafe.id, data));
    } catch(e) { next(e); }
  });
  // Billing is retired for internal restaurant management. Keep explicit responses for old clients.
  app.all(['/api/super-admin/payments', '/api/super-admin/payments/:restaurantId'], isSuperAdmin, (_req, res) => {
    res.status(410).json({ message: 'Payments are disabled for internal restaurant management.' });
  });

  app.post('/api/super-admin/restaurants/:restaurantId/categories', isSuperAdmin, async (req, res, next) => {
    try {
      if (!await storage.getRestaurantById(req.params.restaurantId)) return res.status(404).json({ message: 'Café not found' });
      const data = insertCategorySchema.parse({ ...req.body, restaurantId: req.params.restaurantId });
      const cats = await storage.getCategoriesByRestaurantId(data.restaurantId);
      if (cats.some(c => c.title.toLowerCase() === data.title.toLowerCase())) return res.status(400).json({ message: 'Category already exists' });
      res.json(await storage.createCategory(data));
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/categories/:id', isSuperAdmin, async (req, res, next) => {
    try {
      const [category] = await db.select().from(categories).where(eq(categories.id, req.params.id));
      if (!category) return res.status(404).json({ message: 'Category not found' });
      const data = insertCategorySchema.pick({ title: true, order: true }).partial().strict().parse(req.body);
      const cats = await storage.getCategoriesByRestaurantId(category.restaurantId);
      if (data.title && cats.some(c => c.id !== category.id && c.title.toLowerCase() === data.title!.toLowerCase())) return res.status(400).json({ message: 'Category already exists' });
      res.json(await storage.updateCategory(category.id, data));
    } catch (e) { next(e); }
  });
  app.post('/api/super-admin/restaurants/:restaurantId/menu-items', isSuperAdmin, async (req: any, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.restaurantId);
      if (!cafe) return res.status(404).json({ message: 'Café not found' });
      const data = insertMenuItemSchema.parse(req.body);
      if (!(await storage.getCategoriesByRestaurantId(cafe.id)).some(c => c.id === data.categoryId)) return res.status(400).json({ message: 'Choose a category from this café' });
      if (data.imageUrl) { await media.mediaType(data.imageUrl, true); data.imageUrl = await mediaForCafe(data.imageUrl, cafe.userId, req.user.id); }
      if (data.hasMultiplePricing) return res.status(400).json({ message: 'Use the café workspace to save price options together' });
      res.json(await storage.createMenuItem({ ...data, price: String(data.price), discount: String(data.discount || 0) }));
    } catch (e) { next(e); }
  });
  app.put('/api/super-admin/menu-items/:id', isSuperAdmin, async (req: any, res, next) => {
    try {
      const [item] = await db.select().from(menuItems).where(eq(menuItems.id, req.params.id));
      if (!item) return res.status(404).json({ message: 'Menu item not found' });
      const [category] = await db.select().from(categories).where(eq(categories.id, item.categoryId));
      const cafe = await storage.getRestaurantById(category.restaurantId);
      const data = insertMenuItemSchema.partial().parse(req.body);
      if (data.categoryId && !(await storage.getCategoriesByRestaurantId(category.restaurantId)).some(c => c.id === data.categoryId)) return res.status(400).json({ message: 'Use the library to copy items to another café' });
      if (data.hasMultiplePricing !== undefined && data.hasMultiplePricing !== item.hasMultiplePricing) return res.status(400).json({ message: 'Use the café workspace to change price options' });
      if (data.imageUrl) { await media.mediaType(data.imageUrl, true); data.imageUrl = await mediaForCafe(data.imageUrl, cafe!.userId, req.user.id); }
      res.json(await storage.updateMenuItem(item.id, { ...data, ...(data.price === undefined ? {} : { price: String(data.price) }), ...(data.discount === undefined ? {} : { discount: String(data.discount) }) }));
    } catch (e) { next(e); }
  });
}
