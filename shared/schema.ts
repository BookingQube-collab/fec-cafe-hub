import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  check,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Database-backed staff sessions.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("admin"), // "admin" or "super_admin"
  accountStatus: varchar("account_status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [uniqueIndex('users_email_case_unique').on(sql`lower(${table.email})`), check('users_management_role', sql`${table.role} in ('admin','super_admin')`), check('users_account_status', sql`${table.accountStatus} in ('active','frozen','deleted')`)]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const mediaObjects = pgTable('media_objects', {
  id: varchar('id').primaryKey(),
  ownerId: varchar('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  id: varchar('id').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
}, table => [index('rate_limit_buckets_expiry').on(table.resetAt)]);

// Login schema for authentication
export const emailSchema = z.string().trim().toLowerCase().max(254).email('Invalid email address');
export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(72).refine(v => new TextEncoder().encode(v).length <= 72, 'Password must be at most 72 UTF-8 bytes');
export const registrationSchema = z.object({ email: emailSchema, password: passwordSchema,
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  restaurantName: z.string().trim().min(1).max(150),
}).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72).refine(v => new TextEncoder().encode(v).length <= 72, 'Password is too long') }).strict();

export type LoginCredentials = z.infer<typeof loginSchema>;

// Restaurants table
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  theme: text("theme").notNull().default("e3"),
  currency: varchar("currency").notNull().default("SAR"),
  timezone: text("timezone").notNull().default("Asia/Riyadh"),
  logoUrl: text("logo_url"),
  coverMediaUrl: text("cover_media_url"), // Cover media for menu display (video/GIF/image)
  coverMediaType: varchar("cover_media_type"), // "image", "video", "gif"
  cuisineType: text("cuisine_type"),
  address: text("address"),
  phone: varchar("phone"),
  openingHours: text("opening_hours"),
  qrCodeUrl: text("qr_code_url"),
  status: varchar("status").notNull().default("active"), // "active", "suspended", "pending"
  hidden: boolean("hidden").notNull().default(false), // Super Admin can hide restaurants from public view
  upiId: text("upi_id"), // UPI payment ID (e.g., merchant@upi)
  upiQrCodeUrl: text("upi_qr_code_url"), // URL to uploaded UPI QR code image
  
  // Legacy billing fields retained for database compatibility; internal app does not use billing.
  activeSince: timestamp("active_since").defaultNow(),
  subscriptionStatus: varchar("subscription_status").notNull().default("trial"), // "trial", "active", "expired", "cancelled"
  subscriptionPlan: varchar("subscription_plan").default("monthly"), // "monthly", "quarterly", "annual"
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).default("999"), // Subscription fee
  lastPaymentDate: timestamp("last_payment_date"),
  nextPaymentDue: timestamp("next_payment_due"),
  suspensionReason: text("suspension_reason"), // Reason for suspension (e.g., "Non-payment", "Policy violation")
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [uniqueIndex('restaurants_one_owner').on(table.userId), check('restaurants_status', sql`${table.status} in ('active','suspended','pending')`)]);

export const menuDesigns = pgTable('menu_designs', {
  restaurantId: varchar('restaurant_id').primaryKey().references(() => restaurants.id, { onDelete: 'cascade' }),
  // App treats a missing row as enabled=true; column default true for new inserts.
  // Classic menu only when a café explicitly sets enabled=false.
  enabled: boolean('enabled').notNull().default(true),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by'),
});
export type MenuDesign = typeof menuDesigns.$inferSelect;

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  user: one(users, {
    fields: [restaurants.userId],
    references: [users.id],
  }),
  categories: many(categories),
  menuDesign: one(menuDesigns, {
    fields: [restaurants.id],
    references: [menuDesigns.restaurantId],
  }),
}));

export const menuDesignsRelations = relations(menuDesigns, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [menuDesigns.restaurantId],
    references: [restaurants.id],
  }),
}));

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  qrCodeUrl: true,
});

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

export const cafeProfileSchema = insertRestaurantSchema.pick({ name: true, theme: true, currency: true, timezone: true,
  logoUrl: true, coverMediaUrl: true, coverMediaType: true, cuisineType: true, address: true, phone: true,
  openingHours: true }).extend({
  name: z.string().trim().min(1).max(150), theme: z.enum(['e3','forest','terracotta','ocean','plum']).optional(),
  currency: z.enum(['SAR','QAR','INR','AED','USD','EUR','GBP']).optional(),
  timezone: z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }).optional(),
  coverMediaType: z.enum(['image','video','gif']).nullable().optional(),
  cuisineType: z.string().trim().max(250).nullable().optional(), address: z.string().trim().max(1000).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(), openingHours: z.string().trim().max(250).nullable().optional(),
}).strict();

export type CafeAccessContext = Pick<Restaurant, 'id' | 'name' | 'theme'> & {
  owner: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
};
export type AuthUser = Omit<User, 'password'> & { cafeContext: CafeAccessContext | null };

export const accessAudit = pgTable('access_audit', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar('actor_id').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: varchar('actor_role').notNull(),
  cafeId: varchar('cafe_id'),
  cafeName: text('cafe_name'),
  action: text('action').notNull(),
  status: integer('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, table => [index('access_audit_recent').on(table.createdAt)]);
export type AccessAudit = typeof accessAudit.$inferSelect;

// Categories table
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, table => [uniqueIndex('categories_cafe_name_unique').on(table.restaurantId, sql`lower(btrim(${table.title}))`)]);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id],
  }),
  menuItems: many(menuItems),
}));

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
}).extend({ title: z.string().trim().min(1).max(100), order: z.number().int().min(0).optional() });

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

const moneySchema = z.string().or(z.number()).refine(v => /^\d+(?:\.\d{1,2})?$/.test(String(v)) && Number(v) <= 99999999.99, 'Use a non-negative price with at most two decimal places');
const discountSchema = z.string().or(z.number()).refine(v => /^\d+(?:\.\d{1,2})?$/.test(String(v)) && Number(v) <= 100, 'Discount must be between 0 and 100, with at most two decimal places');
const arabicOptionLabel = z.string().trim().max(80).optional();
export const menuModifierOptionSchema = z.object({
  id: z.string().uuid(), label: z.string().trim().min(1).max(80), labelAr: arabicOptionLabel,
  price: moneySchema.transform(String), isAvailable: z.boolean().default(true),
}).strict();
export const menuModifierGroupSchema = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(80), titleAr: arabicOptionLabel,
  selection: z.enum(['single', 'multiple']), minSelections: z.number().int().min(0).max(20),
  maxSelections: z.number().int().min(1).max(20), options: z.array(menuModifierOptionSchema).min(1).max(20),
}).strict().superRefine((group, context) => {
  if (group.maxSelections < group.minSelections || group.maxSelections > group.options.length)
    context.addIssue({ code: 'custom', message: 'Selection limits must fit the number of options', path: ['maxSelections'] });
  if (group.selection === 'single' && (group.maxSelections !== 1 || group.minSelections > 1))
    context.addIssue({ code: 'custom', message: 'A single-choice group allows at most one option', path: ['maxSelections'] });
  if (new Set(group.options.map(option => option.id)).size !== group.options.length ||
    new Set(group.options.map(option => option.label.toLowerCase())).size !== group.options.length)
    context.addIssue({ code: 'custom', message: 'Give every option a unique name and identifier', path: ['options'] });
});
export const menuModifierGroupsSchema = z.array(menuModifierGroupSchema).max(8).superRefine((groups, context) => {
  if (new Set(groups.map(group => group.id)).size !== groups.length || new Set(groups.map(group => group.title.toLowerCase())).size !== groups.length)
    context.addIssue({ code: 'custom', message: 'Give every option group a unique name and identifier' });
  const optionIds = groups.flatMap(group => group.options.map(option => option.id));
  if (new Set(optionIds).size !== optionIds.length) context.addIssue({ code: 'custom', message: 'Every choice must have a unique identifier within the item' });
});
export type MenuModifierOption = z.infer<typeof menuModifierOptionSchema>;
export type MenuModifierGroup = z.infer<typeof menuModifierGroupSchema>;

// Menu Items table
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  unit: text("unit").notNull().default("plate"), // e.g., "plate", "piece", "kg", "gram", "liter", "ml", "half", "quarter", "full"
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  specialDate: varchar("special_date"),
  hasMultiplePricing: boolean("has_multiple_pricing").notNull().default(false),
  modifierGroups: jsonb('modifier_groups').$type<MenuModifierGroup[]>().notNull().default(sql`'[]'::jsonb`),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [check('menu_price_valid', sql`${table.price} >= 0`), check('menu_discount_valid', sql`${table.discount} between 0 and 100`), check('menu_modifier_groups_array', sql`jsonb_typeof(${table.modifierGroups}) = 'array' and jsonb_array_length(${table.modifierGroups}) <= 8`)]);

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  priceVariants: many(menuItemPriceVariants),
}));

// Menu Item Price Variants table (for multiple pricing options)
export const menuItemPriceVariants = pgTable("menu_item_price_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g., "Full Plate", "Half Plate", "1 Kg"
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  unit: text("unit").notNull(), // e.g., "plate", "kg", "gram", "liter", "ml", "piece"
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, table => [check('option_price_valid', sql`${table.price} >= 0`), check('option_discount_valid', sql`${table.discount} between 0 and 100`), uniqueIndex('option_item_label_unique').on(table.menuItemId, sql`lower(btrim(${table.label}))`)]);

export const menuItemPriceVariantsRelations = relations(menuItemPriceVariants, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [menuItemPriceVariants.menuItemId],
    references: [menuItems.id],
  }),
}));

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().trim().min(1).max(150),
  categoryId: z.string().uuid(),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).refine(v => new Set(v.map(t => t.toLowerCase())).size === v.length, 'Tags must be unique').nullable().optional(),
  order: z.number().int().min(0).optional(),
  price: moneySchema,
  unit: z.string().trim().min(1).max(30).optional(),
  discount: discountSchema.optional(),
  modifierGroups: menuModifierGroupsSchema.optional(),
  specialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid date').nullable().optional(),
}).strict();

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// Price variant schemas
export const insertPriceVariantSchema = createInsertSchema(menuItemPriceVariants).omit({
  id: true,
  createdAt: true,
}).extend({
  menuItemId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  price: moneySchema,
  unit: z.string().trim().min(1).max(30),
  discount: discountSchema.optional(),
  order: z.number().int().min(0).optional(),
}).strict();

export type InsertPriceVariant = z.infer<typeof insertPriceVariantSchema>;
export type PriceVariant = typeof menuItemPriceVariants.$inferSelect;

export type LibraryPriceVariant = { label: string; price: string; unit: string };

// Saved templates survive changes to, or deletion of, the original café menu.
export const globalMenuItems = pgTable("global_menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceItemId: varchar("source_item_id").unique().references(() => menuItems.id, { onDelete: "set null" }),
  publisherId: varchar("publisher_id").references(() => users.id, { onDelete: "set null" }),
  sourceCafe: text("source_cafe").notNull(),
  currency: varchar("currency").notNull(),
  categoryTitle: text("category_title").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  imageUrl: text("image_url"),
  sourceImageUrl: text("source_image_url"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  variants: jsonb("variants").$type<LibraryPriceVariant[]>().notNull().default(sql`'[]'::jsonb`),
  modifierGroups: jsonb('modifier_groups').$type<MenuModifierGroup[]>().notNull().default(sql`'[]'::jsonb`),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type GlobalMenuItem = typeof globalMenuItems.$inferSelect;

// Payments table - Track subscription payments for restaurants
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  paymentMethod: varchar("payment_method").notNull(), // "cash", "upi", "bank_transfer", "card"
  transactionId: varchar("transaction_id"), // Reference ID from payment gateway
  requestKey: varchar('request_key').unique(),
  status: varchar("status").notNull().default("completed"), // "completed", "pending", "failed"
  periodStart: timestamp("period_start").notNull(), // Subscription period start
  periodEnd: timestamp("period_end").notNull(), // Subscription period end
  notes: text("notes"), // Additional notes from super admin
  recordedBy: varchar("recorded_by").references(() => users.id), // Super admin who recorded the payment
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [payments.restaurantId],
    references: [restaurants.id],
  }),
  recordedByUser: one(users, {
    fields: [payments.recordedBy],
    references: [users.id],
  }),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()),
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type PublicCafe = Pick<Restaurant, 'id' | 'name' | 'theme' | 'currency' | 'timezone' | 'logoUrl' | 'coverMediaUrl' | 'coverMediaType' | 'cuisineType' | 'address' | 'phone' | 'openingHours'>;
export interface PublicMenuData {
  restaurant: PublicCafe;
  categories: Category[];
  items: MenuItem[];
  variants: PriceVariant[];
  /** Missing DB row is returned as enabled:true + empty settings. Classic when enabled:false. */
  design: { enabled: boolean; settings: Record<string, unknown> };
}
