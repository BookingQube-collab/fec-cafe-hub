import { type Express, type RequestHandler } from 'express';
import { storage } from './storage';
import { db } from './db';
import { categories, restaurants, menuItems, menuItemPriceVariants, sessions, users, insertMenuItemSchema, insertPriceVariantSchema, cafeProfileSchema, passwordSchema } from '@shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { isAuthenticated } from './localAuth';
import bcrypt from './passwords';
import { z } from 'zod';
import { ObjectStorageService } from './localObjects';
import { getManagedCafe, mediaOwner } from './accessControl';
import { mountPricingControls } from './pricingControls';
import { rateLimit } from './httpSecurity';
const profileFields = ['name','theme','currency','timezone','logoUrl','coverMediaUrl','coverMediaType','cuisineType','address','phone','openingHours'];
export function mountCafeControls(app: Express) {
  const guarded: RequestHandler = async (req: any, res, next) => {
    try {
      // Enforce ownership on the original API, including moved category/item IDs.
      if (req.path.startsWith('/api/super-admin') || !req.path.startsWith('/api/')) return next();
      const publicMatch = req.path.match(/^\/api\/(restaurant|categories|menu-items)\/public\/([^/]+)$/) || req.path.match(/^\/api\/price-variants\/public\/restaurant\/([^/]+)$/);
      if (publicMatch) {
        const id = publicMatch.length === 3 ? publicMatch[2] : publicMatch[1];
        const cafe = await storage.getRestaurantById(id);
        if (!cafe || cafe.hidden || cafe.status !== 'active') return res.status(404).json({ message: 'Café unavailable' });
      }
      const variantPublic = req.path.match(/^\/api\/price-variants\/public\/([^/]+)$/);
      if (variantPublic) {
        const cafes = (await storage.getAllRestaurants()).filter(c => !c.hidden && c.status === 'active');
        let allowed = false;
        for (const cafe of cafes) if ((await storage.getMenuItemsByRestaurantId(cafe.id)).some(i => i.id === variantPublic[1] && i.isAvailable)) allowed = true;
        if (!allowed) return res.sendStatus(404);
      }
      const resource = req.path.match(/^\/api\/(restaurant|categories|menu-items|price-variants)(?:\/|$)/);
      if (!resource || req.path.includes('/public/')) return next();
      const user = req.user || await storage.getUser(req.session?.userId || '');
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      req.user = user;
      const cafe = await getManagedCafe(req);
      if (resource[1] === 'restaurant') {
        if (req.method === 'POST') {
          if (req.body.userId && req.body.userId !== (cafe?.userId || user.id)) return res.status(403).json({ message: 'Café ownership cannot be changed here' });
          if (['role','status','hidden','subscriptionStatus','subscriptionPlan','monthlyFee','lastPaymentDate','nextPaymentDue','suspensionReason','activeSince'].some(k => k in req.body)) return res.status(403).json({ message: 'Platform controls require the super admin dashboard' });
          if (Object.keys(req.body).some(k => ![...profileFields, 'userId', 'expectedUpdatedAt'].includes(k))) return res.status(400).json({ message: 'Unknown café profile field' });
          const picked = Object.fromEntries(profileFields.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]]));
          const parsed = cafeProfileSchema.parse(picked);
          for (const field of ['logoUrl','coverMediaUrl'] as const) if (parsed[field]) {
            try {
              const media = new ObjectStorageService();
              await media.trySetObjectEntityAclPolicy(String(parsed[field]), { owner: cafe?.userId || user.id, visibility: 'public' });
              const kind = await media.mediaType(String(parsed[field]), field !== 'coverMediaUrl');
              if (field === 'coverMediaUrl') parsed.coverMediaType = kind;
            }
            catch { return res.status(400).json({ message: 'Choose media uploaded by your café account' }); }
          }
          if ('coverMediaUrl' in parsed && !parsed.coverMediaUrl) parsed.coverMediaType = null;
          const expectedUpdatedAt = req.body.expectedUpdatedAt === undefined ? undefined : z.string().datetime().parse(req.body.expectedUpdatedAt);
          req.body = { ...parsed, userId: cafe?.userId || user.id, expectedUpdatedAt };
        }
        return next();
      }
      if (!cafe) return res.status(404).json({ message: 'Set up your café first' });
      const id = req.path.split('/')[3];
      const [cats, items, variants] = await Promise.all([
        req.body?.categoryId || resource[1] === 'categories' && (id || ['POST','PUT'].includes(req.method)) ? storage.getCategoriesByRestaurantId(cafe.id) : Promise.resolve([]),
        req.body?.menuItemId || id && (resource[1] === 'menu-items' || resource[1] === 'price-variants' && req.method === 'GET') ? storage.getMenuItemsByRestaurantId(cafe.id) : Promise.resolve([]),
        id && resource[1] === 'price-variants' && req.method !== 'GET' ? storage.getPriceVariantsByRestaurantId(cafe.id) : Promise.resolve([]),
      ]);
      if (resource[1] === 'categories' && ['POST','PUT'].includes(req.method)) {
        req.body.title = z.string().trim().min(1).max(100).parse(req.body.title);
        if (cats.some(c => c.id !== id && c.title.toLowerCase() === req.body.title.toLowerCase())) return res.status(400).json({ message: 'A category with this name already exists' });
      }
      if (req.body?.restaurantId && req.body.restaurantId !== cafe.id) return res.sendStatus(403);
      if (req.body?.categoryId && !cats.some(c => c.id === req.body.categoryId)) return res.sendStatus(403);
      if (req.body?.menuItemId && !items.some(i => i.id === req.body.menuItemId)) return res.sendStatus(403);
      if (resource[1] === 'menu-items' && ['POST','PUT'].includes(req.method) && req.body?.imageUrl) {
        try { const media = new ObjectStorageService(); await media.trySetObjectEntityAclPolicy(req.body.imageUrl, { owner: cafe.userId, visibility: 'public' }); await media.mediaType(req.body.imageUrl, true); }
        catch { return res.status(400).json({ message: 'Choose a photo uploaded for this café' }); }
      }
      if (id && id !== 'image') {
        const owned = resource[1] === 'categories' ? cats.some(c => c.id === id) : resource[1] === 'menu-items' ? items.some(i => i.id === id) : req.method === 'GET' ? items.some(i => i.id === id) : variants.some(v => v.id === id);
        if (!owned) return res.status(404).json({ message: 'Item not found' });
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues.map(i => i.message).join(', ') });
      next(error);
    }
  };
  app.use(guarded);
  mountPricingControls(app);
  app.post('/api/restaurant', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId, expectedUpdatedAt, ...profile } = req.body;
      const data = cafeProfileSchema.parse(profile);
      const result = await db.transaction(async tx => {
        const [current] = await tx.select().from(restaurants).where(eq(restaurants.userId, userId)).for('update');
        if (current && expectedUpdatedAt && current.updatedAt?.getTime() !== new Date(expectedUpdatedAt).getTime()) throw Object.assign(new Error('This café profile changed after you opened it. Reload before saving.'), { status: 409 });
        const [cafe] = current ? await tx.update(restaurants).set({ ...data, updatedAt: new Date() }).where(eq(restaurants.id, current.id)).returning() : await tx.insert(restaurants).values({ ...data, userId }).returning();
        return cafe;
      });
      res.json(result);
    } catch(e) { next(e); }
  });
  app.get('/api/manager-menu', isAuthenticated, async (req: any, res, next) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) return res.json({ restaurant: null, categories: [], items: [], variants: [] });
      const [cats, items, variants] = await Promise.all([storage.getCategoriesByRestaurantId(restaurant.id), storage.getMenuItemsByRestaurantId(restaurant.id), storage.getPriceVariantsByRestaurantId(restaurant.id)]);
      res.json({ restaurant, categories: cats, items, variants });
    } catch (e) { next(e); }
  });
  // Save the item and all of its price options together, or roll back both.
  app.post('/api/manager-menu', isAuthenticated, async (req: any, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.status(404).json({ message: 'Set up your café first' });
      const data = insertMenuItemSchema.extend({ order: z.number().int().min(0).optional() }).parse(req.body.item);
      if (data.imageUrl) {
        try { const media = new ObjectStorageService(); await media.trySetObjectEntityAclPolicy(data.imageUrl, { owner: await mediaOwner(req), visibility: 'public' }); await media.mediaType(data.imageUrl, true); }
        catch { return res.status(400).json({ message: 'Choose a photo uploaded by your café account' }); }
      }
      const cats = await storage.getCategoriesByRestaurantId(cafe.id);
      if (!cats.some(c => c.id === data.categoryId)) return res.status(403).json({ message: 'Choose a category from your café' });
      const id = req.body.id;
      if (id && !(await storage.getMenuItemsByRestaurantId(cafe.id)).some(i => i.id === id)) return res.status(404).json({ message: 'Item not found' });
      const options = z.array(insertPriceVariantSchema.omit({ menuItemId: true })).max(3).parse(req.body.variants || []);
      if (data.hasMultiplePricing && !options.length) return res.status(400).json({ message: 'Add at least one price option' });
      if (!data.hasMultiplePricing && options.length) return res.status(400).json({ message: 'Enable multiple pricing to save price options' });
      if (new Set(options.map(v => v.label.toLowerCase())).size !== options.length) return res.status(400).json({ message: 'Price option labels must be unique' });
      const values = { ...data, price: String(data.price), discount: String(data.discount || 0) };
      const revision = req.body.expectedUpdatedAt === undefined ? undefined : z.string().datetime().parse(req.body.expectedUpdatedAt);
      const result = await db.transaction(async tx => {
        if (id) {
          const [current] = await tx.select().from(menuItems).where(eq(menuItems.id, id)).for('update');
          if (!current) throw Object.assign(new Error('Item not found'), { status: 404 });
          if (revision && current.updatedAt?.getTime() !== new Date(revision).getTime()) throw Object.assign(new Error('This item changed after you opened it. Close the editor, refresh, and try again.'), { status: 409 });
        }
        const [item] = id ? await tx.update(menuItems).set({ ...values, updatedAt: new Date() }).where(eq(menuItems.id, id)).returning() : await tx.insert(menuItems).values(values).returning();
        await tx.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, item.id));
        const variants = options.length ? await tx.insert(menuItemPriceVariants).values(options.map((v, order) => ({ ...v, menuItemId: item.id, price: String(v.price), discount: String(v.discount || 0), order }))).returning() : [];
        return { ...item, variants };
      });
      res.json(result);
    } catch (e) { if (e instanceof z.ZodError) return res.status(400).json({ message: e.issues.map(i => i.message).join(', ') }); next(e); }
  });
  app.put('/api/category-order', isAuthenticated, async (req: any, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      const ids = z.array(z.string()).parse(req.body.ids);
      const owned = await storage.getCategoriesByRestaurantId(cafe.id);
      if (ids.length !== owned.length || new Set(ids).size !== ids.length || ids.some(id => !owned.some(c => c.id === id))) return res.status(400).json({ message: 'Order must contain every category from your café once' });
      await db.transaction(async tx => { for (let order = 0; order < ids.length; order++) await tx.update(categories).set({ order }).where(eq(categories.id, ids[order])); });
      res.json({ success: true });
    } catch(e) { next(e); }
  });
  app.get('/api/cafes', async (_req, res, next) => {
    try { res.json((await storage.getAllRestaurants()).filter(c => c.status === 'active' && !c.hidden).map(({ id, name, theme, cuisineType, logoUrl }) => ({ id, name, theme, cuisineType, logoUrl }))); } catch(e) { next(e); }
  });
  app.get('/api/menu/public/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const restaurant = await storage.getRestaurantById(id);
      if (!restaurant || restaurant.hidden || restaurant.status !== 'active') return res.status(404).json({ message: 'Café unavailable' });
      const [cats, allItems, allVariants] = await Promise.all([storage.getCategoriesByRestaurantId(id), storage.getMenuItemsByRestaurantId(id), storage.getPriceVariantsByRestaurantId(id)]);
      const items = allItems.filter(item => item.isAvailable);
      const visibleIds = new Set(items.map(item => item.id));
      const { name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours } = restaurant;
      res.json({ restaurant: { id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours }, categories: cats, items, variants: allVariants.filter(v => visibleIds.has(v.menuItemId)) });
    } catch (e) { next(e); }
  });
  app.put('/api/categories/:id', isAuthenticated, async (req, res, next) => {
    try { res.json(await storage.updateCategory(req.params.id, z.object({ title: z.string().trim().min(1), order: z.number().int().min(0).optional() }).parse(req.body))); } catch(e) { next(e); }
  });
  app.get('/api/cafe-backup', isAuthenticated, async (req: any, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      res.attachment('cafe-menu-backup.json').json({ version: 1, exportedAt: new Date().toISOString(), restaurant: cafe, categories: await storage.getCategoriesByRestaurantId(cafe.id), menuItems: await storage.getMenuItemsByRestaurantId(cafe.id), priceVariants: await storage.getPriceVariantsByRestaurantId(cafe.id) });
    } catch(e) { next(e); }
  });
  app.delete('/api/cafe-menu', isAuthenticated, async (req: any, res, next) => {
    try {
      if (req.body.confirmation !== 'CLEAR MENU') return res.status(400).json({ message: 'Type CLEAR MENU to confirm' });
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      await db.delete(categories).where(eq(categories.restaurantId, cafe.id));
      res.json({ success: true });
    } catch(e) { next(e); }
  });
  app.put('/api/account/password', isAuthenticated, rateLimit(5, 15 * 60 * 1000, req => (req as any).user.id), async (req: any, res, next) => {
    try {
      const data = z.object({ currentPassword: z.string().max(72), newPassword: passwordSchema }).strict().parse(req.body);
      if (!await bcrypt.compare(data.currentPassword, req.user.password)) return res.status(400).json({ message: 'Current password is incorrect' });
      const password = await bcrypt.hash(data.newPassword, 12);
      await db.transaction(async tx => {
        await tx.update(users).set({ password, updatedAt: new Date() }).where(eq(users.id, req.user.id));
        await tx.delete(sessions).where(and(sql`${sessions.sess}->>'userId' = ${req.user.id}`, ne(sessions.sid, req.sessionID)));
      });
      res.json({ success: true });
    } catch(e) { next(e); }
  });
}
