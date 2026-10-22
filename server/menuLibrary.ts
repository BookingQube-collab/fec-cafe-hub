import type { Express } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './localAuth';
import { ObjectStorageService } from './localObjects';
import { categories, globalMenuItems, menuItems, menuItemPriceVariants, restaurants } from '@shared/schema';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const idSchema = z.string().uuid();
const itemIdsSchema = z.array(idSchema).min(1).max(500).refine(ids => new Set(ids).size === ids.length, 'Select each item once');
const media = new ObjectStorageService();

export function mountMenuLibrary(app: Express) {
  app.get('/api/menu-library', isAuthenticated, async (req: any, res, next) => {
    try {
      const items = await db.select().from(globalMenuItems).where(eq(globalMenuItems.archived, false)).orderBy(asc(globalMenuItems.categoryTitle), asc(globalMenuItems.name));
      res.json(items.map(({ sourceImageUrl, ...item }) => ({ ...item, canManage: req.user.role === 'super_admin' || item.publisherId === req.user.id })));
    } catch (e) { next(e); }
  });

  app.get('/api/menu-library/targets', isAuthenticated, async (req: any, res, next) => {
    try {
      const targets = await db.select({ id: restaurants.id, name: restaurants.name, currency: restaurants.currency, theme: restaurants.theme }).from(restaurants)
        .where(req.user.role === 'super_admin' ? undefined : eq(restaurants.userId, req.user.id)).orderBy(asc(restaurants.name));
      const cats = targets.length ? await db.select().from(categories).where(inArray(categories.restaurantId, targets.map(c => c.id))).orderBy(asc(categories.order)) : [];
      res.json(targets.map(c => ({ ...c, categories: cats.filter(cat => cat.restaurantId === c.id) })));
    } catch (e) { next(e); }
  });

  app.post('/api/menu-library/publish', isAuthenticated, async (req: any, res, next) => {
    const copies: string[] = [];
    try {
      const input = z.object({ restaurantId: idSchema, itemIds: itemIdsSchema.optional() }).parse(req.body);
      const result = await db.transaction(async tx => {
        const [cafe] = await tx.select().from(restaurants).where(eq(restaurants.id, input.restaurantId)).for('update');
        if (!cafe || (req.user.role !== 'super_admin' && cafe.userId !== req.user.id)) return null;
        const source = await tx.select({ item: menuItems, category: categories }).from(menuItems).innerJoin(categories, eq(menuItems.categoryId, categories.id))
          .where(and(eq(categories.restaurantId, cafe.id), input.itemIds ? inArray(menuItems.id, input.itemIds) : undefined)).orderBy(asc(categories.order), asc(menuItems.order));
        if (input.itemIds && source.length !== input.itemIds.length) throw new Error('Choose items from this café');
        const variants = source.length ? await tx.select().from(menuItemPriceVariants).where(inArray(menuItemPriceVariants.menuItemId, source.map(s => s.item.id))).orderBy(asc(menuItemPriceVariants.order)) : [];
        for (const { item, category } of source) {
          const [existing] = await tx.select().from(globalMenuItems).where(eq(globalMenuItems.sourceItemId, item.id));
          let imageUrl = existing?.sourceImageUrl === item.imageUrl ? existing.imageUrl : null;
          if (item.imageUrl && !imageUrl) {
            imageUrl = await media.copyForOwner(item.imageUrl, cafe.userId);
            copies.push(imageUrl);
          }
          const values = { sourceItemId: item.id, publisherId: cafe.userId, sourceCafe: cafe.name, currency: cafe.currency,
            categoryTitle: category.title, name: item.name, description: item.description, price: item.price, unit: item.unit,
            tags: item.tags || [], sourceImageUrl: item.imageUrl, imageUrl, modifierGroups: item.modifierGroups || [],
            variants: item.hasMultiplePricing ? variants.filter(v => v.menuItemId === item.id).map(({ label, price, unit }) => ({ label, price, unit })) : [],
            archived: false, updatedAt: new Date() };
          await tx.insert(globalMenuItems).values(values).onConflictDoUpdate({ target: globalMenuItems.sourceItemId, set: values });
        }
        return { saved: source.length };
      });
      if (!result) return res.status(403).json({ message: 'Choose a café you manage' });
      res.json(result);
    } catch (e) {
      await Promise.all(copies.map(url => media.removeCopiedObject(url)));
      if (e instanceof Error && e.message === 'Choose items from this café') return res.status(400).json({ message: e.message });
      next(e);
    }
  });

  app.post('/api/menu-library/import', isAuthenticated, async (req: any, res, next) => {
    const copies: string[] = [];
    try {
      const input = z.object({ restaurantId: idSchema, itemIds: itemIdsSchema, categoryId: idSchema.optional(),
        isAvailable: z.boolean().default(false), acceptCurrencyDifference: z.boolean().default(false) }).parse(req.body);
      const result = await db.transaction(async tx => {
        // Serialize imports into a café so simultaneous clicks cannot create duplicates.
        const [cafe] = await tx.select().from(restaurants).where(eq(restaurants.id, input.restaurantId)).for('update');
        if (!cafe || (req.user.role !== 'super_admin' && cafe.userId !== req.user.id)) return { error: 'Choose a café you manage', status: 403 };
        const templates = await tx.select().from(globalMenuItems).where(and(inArray(globalMenuItems.id, input.itemIds), eq(globalMenuItems.archived, false))).orderBy(asc(globalMenuItems.categoryTitle), asc(globalMenuItems.name));
        if (templates.length !== input.itemIds.length) return { error: 'Some library items are no longer available. Refresh and try again.', status: 400 };
        if (!input.acceptCurrencyDifference && templates.some(i => i.currency !== cafe.currency)) return { error: `Confirm copying prices into ${cafe.currency}. Currency conversion is not automatic.`, status: 400 };
        const cats = await tx.select().from(categories).where(eq(categories.restaurantId, cafe.id));
        if (input.categoryId && !cats.some(c => c.id === input.categoryId)) return { error: 'Choose a category from the destination café', status: 400 };
        const existing = cats.length ? await tx.select().from(menuItems).where(inArray(menuItems.categoryId, cats.map(c => c.id))) : [];
        const names = new Set(existing.map(i => `${i.categoryId}:${normalize(i.name)}`));
        const createdIds: string[] = [], createdCategoryIds: string[] = [];
        let skipped = 0, categoryOrder = Math.max(-1, ...cats.map(c => c.order)) + 1;
        const nextOrder = new Map(cats.map(c => [c.id, Math.max(-1, ...existing.filter(i => i.categoryId === c.id).map(i => i.order)) + 1]));
        for (const template of templates) {
          let category = input.categoryId ? cats.find(c => c.id === input.categoryId)! : cats.find(c => normalize(c.title) === normalize(template.categoryTitle));
          if (!category) {
            [category] = await tx.insert(categories).values({ restaurantId: cafe.id, title: template.categoryTitle, order: categoryOrder++ }).returning();
            cats.push(category); createdCategoryIds.push(category.id);
          }
          const key = `${category.id}:${normalize(template.name)}`;
          if (names.has(key)) { skipped++; continue; }
          let imageUrl: string | null = null;
          if (template.imageUrl) { imageUrl = await media.copyForOwner(template.imageUrl, cafe.userId); copies.push(imageUrl); }
          const order = nextOrder.get(category.id) || 0;
          nextOrder.set(category.id, order + 1);
          const [item] = await tx.insert(menuItems).values({ categoryId: category.id, name: template.name, description: template.description,
            price: template.price, unit: template.unit, imageUrl, tags: template.tags, modifierGroups: template.modifierGroups || [], hasMultiplePricing: template.variants.length > 0,
            discount: '0', specialDate: null, isAvailable: input.isAvailable, order }).returning();
          if (template.variants.length) await tx.insert(menuItemPriceVariants).values(template.variants.map((v, order) => ({ ...v, menuItemId: item.id, discount: '0', order })));
          names.add(key); createdIds.push(item.id);
        }
        return { added: createdIds.length, skipped, createdIds, createdCategoryIds };
      });
      if ('error' in result) return res.status(result.status!).json({ message: result.error });
      res.json(result);
    } catch (e) { await Promise.all(copies.map(url => media.removeCopiedObject(url))); next(e); }
  });

  app.delete('/api/menu-library/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const id = idSchema.parse(req.params.id);
      const [item] = await db.update(globalMenuItems).set({ archived: true, updatedAt: new Date() })
        .where(and(eq(globalMenuItems.id, id), req.user.role === 'super_admin' ? undefined : eq(globalMenuItems.publisherId, req.user.id))).returning({ id: globalMenuItems.id });
      if (!item) return res.status(404).json({ message: 'Library item not found or belongs to another manager' });
      res.json({ success: true });
    } catch (e) { next(e); }
  });
}
