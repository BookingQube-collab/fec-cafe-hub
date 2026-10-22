import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { menuItems, menuItemPriceVariants, insertMenuItemSchema, insertPriceVariantSchema } from '@shared/schema';

const conflict = (message: string) => Object.assign(new Error(message), { status: 400 });
const optionsSchema = z.array(insertPriceVariantSchema.omit({ menuItemId: true })).max(3)
  .refine(v => new Set(v.map(o => o.label.toLowerCase())).size === v.length, 'Price option labels must be unique');

// These legacy endpoints still serve older clients. They share the same pricing
// invariants as the complete editor; every mutation locks the parent item.
export function mountPricingControls(app: Express) {
  app.post('/api/menu-items', async (req, res, next) => {
    try {
      const data = insertMenuItemSchema.parse(req.body);
      if (data.hasMultiplePricing) throw conflict('Use the complete menu editor to add price options');
      const [item] = await db.insert(menuItems).values({ ...data, price: String(data.price), discount: String(data.discount || 0) }).returning();
      res.json(item);
    } catch (e) { next(e); }
  });
  app.put('/api/menu-items/:id', async (req, res, next) => {
    if (req.params.id === 'image') return next();
    try {
      const data = insertMenuItemSchema.partial().parse(req.body);
      if (!Object.keys(data).length) throw conflict('Choose a menu field to update');
      const item = await db.transaction(async tx => {
        const [current] = await tx.select().from(menuItems).where(eq(menuItems.id, req.params.id)).for('update');
        if (!current) throw Object.assign(new Error('Item not found'), { status: 404 });
        if (data.hasMultiplePricing !== undefined && data.hasMultiplePricing !== current.hasMultiplePricing) throw conflict('Use the complete menu editor to change price options');
        const [updated] = await tx.update(menuItems).set({ ...data, price: data.price === undefined ? undefined : String(data.price),
          discount: data.discount === undefined ? undefined : String(data.discount), updatedAt: new Date() }).where(eq(menuItems.id, current.id)).returning();
        return updated;
      });
      res.json(item);
    } catch (e) { next(e); }
  });
  app.post('/api/menu-items/:id/price-variants', async (req, res, next) => {
    try {
      const options = optionsSchema.parse(req.body);
      const result = await db.transaction(async tx => {
        const [item] = await tx.select().from(menuItems).where(eq(menuItems.id, req.params.id)).for('update');
        if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
        await tx.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, item.id));
        const created = options.length ? await tx.insert(menuItemPriceVariants).values(options.map((v, order) => ({ ...v, menuItemId: item.id, price: String(v.price), discount: String(v.discount || 0), order }))).returning() : [];
        await tx.update(menuItems).set({ hasMultiplePricing: !!options.length,
          ...(options.length ? { price: String(Math.min(...options.map(v => Number(v.price)))) } : {}), updatedAt: new Date() }).where(eq(menuItems.id, item.id));
        return created;
      });
      res.json(result);
    } catch (e) { next(e); }
  });
  for (const method of ['post','put','delete'] as const) app[method](method === 'post' ? '/api/price-variants' : '/api/price-variants/:id', async (req: any, res, next) => {
    try {
      const data = method === 'post' ? insertPriceVariantSchema.parse(req.body) : method === 'put' ? insertPriceVariantSchema.omit({ menuItemId: true }).partial().parse(req.body) : undefined;
      const result = await db.transaction(async tx => {
        const [old] = method === 'post' ? [] : await tx.select().from(menuItemPriceVariants).where(eq(menuItemPriceVariants.id, req.params.id));
        const itemId = method === 'post' ? (data as z.infer<typeof insertPriceVariantSchema>).menuItemId : old?.menuItemId;
        if (!itemId) throw Object.assign(new Error('Price option not found'), { status: 404 });
        const [item] = await tx.select().from(menuItems).where(eq(menuItems.id, itemId)).for('update');
        if (!item?.hasMultiplePricing) throw conflict('Use the complete menu editor to enable price options');
        const options = await tx.select().from(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, itemId));
        if (old && !options.some(v => v.id === old.id)) throw Object.assign(new Error('Price option not found'), { status: 404 });
        const nextOptions = method === 'post' ? [...options, data] : method === 'put' ? options.map(v => v.id === old!.id ? { ...v, ...data } : v) : options.filter(v => v.id !== old!.id);
        if (!nextOptions.length) throw conflict('Use the complete menu editor to switch to a single price');
        optionsSchema.parse(nextOptions.map(v => ({ label: v!.label, price: v!.price, discount: v!.discount || '0', unit: v!.unit })));
        const values = data ? { ...data, price: data.price === undefined ? undefined : String(data.price), discount: data.discount === undefined ? undefined : String(data.discount) } : {};
        const [updated] = method === 'post' ? await tx.insert(menuItemPriceVariants).values({ ...values, menuItemId: itemId } as any).returning() : method === 'put' ? await tx.update(menuItemPriceVariants).set(values).where(eq(menuItemPriceVariants.id, old!.id)).returning() : await tx.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.id, old!.id)).returning();
        await tx.update(menuItems).set({ price: String(Math.min(...nextOptions.map(v => Number(v!.price)))), updatedAt: new Date() }).where(eq(menuItems.id, itemId));
        return method === 'delete' ? { success: true } : updated;
      });
      res.json(result);
    } catch (e) { next(e); }
  });
}
