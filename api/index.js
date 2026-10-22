var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db.ts
import { config } from "dotenv";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accessAudit: () => accessAudit,
  cafeProfileSchema: () => cafeProfileSchema,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  emailSchema: () => emailSchema,
  globalMenuItems: () => globalMenuItems,
  insertCategorySchema: () => insertCategorySchema,
  insertMenuItemSchema: () => insertMenuItemSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertPriceVariantSchema: () => insertPriceVariantSchema,
  insertRestaurantSchema: () => insertRestaurantSchema,
  loginSchema: () => loginSchema,
  mediaObjects: () => mediaObjects,
  menuDesigns: () => menuDesigns,
  menuDesignsRelations: () => menuDesignsRelations,
  menuItemPriceVariants: () => menuItemPriceVariants,
  menuItemPriceVariantsRelations: () => menuItemPriceVariantsRelations,
  menuItems: () => menuItems,
  menuItemsRelations: () => menuItemsRelations,
  menuModifierGroupSchema: () => menuModifierGroupSchema,
  menuModifierGroupsSchema: () => menuModifierGroupsSchema,
  menuModifierOptionSchema: () => menuModifierOptionSchema,
  passwordSchema: () => passwordSchema,
  payments: () => payments,
  paymentsRelations: () => paymentsRelations,
  rateLimitBuckets: () => rateLimitBuckets,
  registrationSchema: () => registrationSchema,
  restaurants: () => restaurants,
  restaurantsRelations: () => restaurantsRelations,
  sessions: () => sessions,
  users: () => users
});
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
  decimal
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("admin"),
  // "admin" or "super_admin"
  accountStatus: varchar("account_status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [uniqueIndex("users_email_case_unique").on(sql`lower(${table.email})`), check("users_management_role", sql`${table.role} in ('admin','super_admin')`), check("users_account_status", sql`${table.accountStatus} in ('active','frozen','deleted')`)]);
var mediaObjects = pgTable("media_objects", {
  id: varchar("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: varchar("id").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull()
}, (table) => [index("rate_limit_buckets_expiry").on(table.resetAt)]);
var emailSchema = z.string().trim().toLowerCase().max(254).email("Invalid email address");
var passwordSchema = z.string().min(10, "Use at least 10 characters").max(72).refine((v) => new TextEncoder().encode(v).length <= 72, "Password must be at most 72 UTF-8 bytes");
var registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  restaurantName: z.string().trim().min(1).max(150)
}).strict();
var loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72).refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long") }).strict();
var restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  theme: text("theme").notNull().default("e3"),
  currency: varchar("currency").notNull().default("SAR"),
  timezone: text("timezone").notNull().default("Asia/Riyadh"),
  logoUrl: text("logo_url"),
  coverMediaUrl: text("cover_media_url"),
  // Cover media for menu display (video/GIF/image)
  coverMediaType: varchar("cover_media_type"),
  // "image", "video", "gif"
  cuisineType: text("cuisine_type"),
  address: text("address"),
  phone: varchar("phone"),
  openingHours: text("opening_hours"),
  qrCodeUrl: text("qr_code_url"),
  status: varchar("status").notNull().default("active"),
  // "active", "suspended", "pending"
  hidden: boolean("hidden").notNull().default(false),
  // Super Admin can hide restaurants from public view
  upiId: text("upi_id"),
  // UPI payment ID (e.g., merchant@upi)
  upiQrCodeUrl: text("upi_qr_code_url"),
  // URL to uploaded UPI QR code image
  // Legacy billing fields retained for database compatibility; internal app does not use billing.
  activeSince: timestamp("active_since").defaultNow(),
  subscriptionStatus: varchar("subscription_status").notNull().default("trial"),
  // "trial", "active", "expired", "cancelled"
  subscriptionPlan: varchar("subscription_plan").default("monthly"),
  // "monthly", "quarterly", "annual"
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).default("999"),
  // Subscription fee
  lastPaymentDate: timestamp("last_payment_date"),
  nextPaymentDue: timestamp("next_payment_due"),
  suspensionReason: text("suspension_reason"),
  // Reason for suspension (e.g., "Non-payment", "Policy violation")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [uniqueIndex("restaurants_one_owner").on(table.userId), check("restaurants_status", sql`${table.status} in ('active','suspended','pending')`)]);
var menuDesigns = pgTable("menu_designs", {
  restaurantId: varchar("restaurant_id").primaryKey().references(() => restaurants.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by")
});
var restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  user: one(users, {
    fields: [restaurants.userId],
    references: [users.id]
  }),
  categories: many(categories),
  menuDesign: one(menuDesigns, {
    fields: [restaurants.id],
    references: [menuDesigns.restaurantId]
  })
}));
var menuDesignsRelations = relations(menuDesigns, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [menuDesigns.restaurantId],
    references: [restaurants.id]
  })
}));
var insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  qrCodeUrl: true
});
var cafeProfileSchema = insertRestaurantSchema.pick({
  name: true,
  theme: true,
  currency: true,
  timezone: true,
  logoUrl: true,
  coverMediaUrl: true,
  coverMediaType: true,
  cuisineType: true,
  address: true,
  phone: true,
  openingHours: true
}).extend({
  name: z.string().trim().min(1).max(150),
  theme: z.enum(["e3", "forest", "terracotta", "ocean", "plum"]).optional(),
  currency: z.enum(["SAR", "QAR", "INR", "AED", "USD", "EUR", "GBP"]).optional(),
  timezone: z.string().max(100).refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }).optional(),
  coverMediaType: z.enum(["image", "video", "gif"]).nullable().optional(),
  cuisineType: z.string().trim().max(250).nullable().optional(),
  address: z.string().trim().max(1e3).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  openingHours: z.string().trim().max(250).nullable().optional()
}).strict();
var accessAudit = pgTable("access_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  actorRole: varchar("actor_role").notNull(),
  cafeId: varchar("cafe_id"),
  cafeName: text("cafe_name"),
  action: text("action").notNull(),
  status: integer("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [index("access_audit_recent").on(table.createdAt)]);
var categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [uniqueIndex("categories_cafe_name_unique").on(table.restaurantId, sql`lower(btrim(${table.title}))`)]);
var categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id]
  }),
  menuItems: many(menuItems)
}));
var insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true
}).extend({ title: z.string().trim().min(1).max(100), order: z.number().int().min(0).optional() });
var moneySchema = z.string().or(z.number()).refine((v) => /^\d+(?:\.\d{1,2})?$/.test(String(v)) && Number(v) <= 9999999999e-2, "Use a non-negative price with at most two decimal places");
var discountSchema = z.string().or(z.number()).refine((v) => /^\d+(?:\.\d{1,2})?$/.test(String(v)) && Number(v) <= 100, "Discount must be between 0 and 100, with at most two decimal places");
var arabicOptionLabel = z.string().trim().max(80).optional();
var menuModifierOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  labelAr: arabicOptionLabel,
  price: moneySchema.transform(String),
  isAvailable: z.boolean().default(true)
}).strict();
var menuModifierGroupSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  titleAr: arabicOptionLabel,
  selection: z.enum(["single", "multiple"]),
  minSelections: z.number().int().min(0).max(20),
  maxSelections: z.number().int().min(1).max(20),
  options: z.array(menuModifierOptionSchema).min(1).max(20)
}).strict().superRefine((group, context) => {
  if (group.maxSelections < group.minSelections || group.maxSelections > group.options.length)
    context.addIssue({ code: "custom", message: "Selection limits must fit the number of options", path: ["maxSelections"] });
  if (group.selection === "single" && (group.maxSelections !== 1 || group.minSelections > 1))
    context.addIssue({ code: "custom", message: "A single-choice group allows at most one option", path: ["maxSelections"] });
  if (new Set(group.options.map((option) => option.id)).size !== group.options.length || new Set(group.options.map((option) => option.label.toLowerCase())).size !== group.options.length)
    context.addIssue({ code: "custom", message: "Give every option a unique name and identifier", path: ["options"] });
});
var menuModifierGroupsSchema = z.array(menuModifierGroupSchema).max(8).superRefine((groups, context) => {
  if (new Set(groups.map((group) => group.id)).size !== groups.length || new Set(groups.map((group) => group.title.toLowerCase())).size !== groups.length)
    context.addIssue({ code: "custom", message: "Give every option group a unique name and identifier" });
  const optionIds = groups.flatMap((group) => group.options.map((option) => option.id));
  if (new Set(optionIds).size !== optionIds.length) context.addIssue({ code: "custom", message: "Every choice must have a unique identifier within the item" });
});
var menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  unit: text("unit").notNull().default("plate"),
  // e.g., "plate", "piece", "kg", "gram", "liter", "ml", "half", "quarter", "full"
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  specialDate: varchar("special_date"),
  hasMultiplePricing: boolean("has_multiple_pricing").notNull().default(false),
  modifierGroups: jsonb("modifier_groups").$type().notNull().default(sql`'[]'::jsonb`),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [check("menu_price_valid", sql`${table.price} >= 0`), check("menu_discount_valid", sql`${table.discount} between 0 and 100`), check("menu_modifier_groups_array", sql`jsonb_typeof(${table.modifierGroups}) = 'array' and jsonb_array_length(${table.modifierGroups}) <= 8`)]);
var menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id]
  }),
  priceVariants: many(menuItemPriceVariants)
}));
var menuItemPriceVariants = pgTable("menu_item_price_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  // e.g., "Full Plate", "Half Plate", "1 Kg"
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  unit: text("unit").notNull(),
  // e.g., "plate", "kg", "gram", "liter", "ml", "piece"
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [check("option_price_valid", sql`${table.price} >= 0`), check("option_discount_valid", sql`${table.discount} between 0 and 100`), uniqueIndex("option_item_label_unique").on(table.menuItemId, sql`lower(btrim(${table.label}))`)]);
var menuItemPriceVariantsRelations = relations(menuItemPriceVariants, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [menuItemPriceVariants.menuItemId],
    references: [menuItems.id]
  })
}));
var insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  name: z.string().trim().min(1).max(150),
  categoryId: z.string().uuid(),
  description: z.string().trim().max(2e3).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).refine((v) => new Set(v.map((t) => t.toLowerCase())).size === v.length, "Tags must be unique").nullable().optional(),
  order: z.number().int().min(0).optional(),
  price: moneySchema,
  unit: z.string().trim().min(1).max(30).optional(),
  discount: discountSchema.optional(),
  modifierGroups: menuModifierGroupsSchema.optional(),
  specialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid date").nullable().optional()
}).strict();
var insertPriceVariantSchema = createInsertSchema(menuItemPriceVariants).omit({
  id: true,
  createdAt: true
}).extend({
  menuItemId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  price: moneySchema,
  unit: z.string().trim().min(1).max(30),
  discount: discountSchema.optional(),
  order: z.number().int().min(0).optional()
}).strict();
var globalMenuItems = pgTable("global_menu_items", {
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
  variants: jsonb("variants").$type().notNull().default(sql`'[]'::jsonb`),
  modifierGroups: jsonb("modifier_groups").$type().notNull().default(sql`'[]'::jsonb`),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  paymentMethod: varchar("payment_method").notNull(),
  // "cash", "upi", "bank_transfer", "card"
  transactionId: varchar("transaction_id"),
  // Reference ID from payment gateway
  requestKey: varchar("request_key").unique(),
  status: varchar("status").notNull().default("completed"),
  // "completed", "pending", "failed"
  periodStart: timestamp("period_start").notNull(),
  // Subscription period start
  periodEnd: timestamp("period_end").notNull(),
  // Subscription period end
  notes: text("notes"),
  // Additional notes from super admin
  recordedBy: varchar("recorded_by").references(() => users.id),
  // Super admin who recorded the payment
  createdAt: timestamp("created_at").defaultNow()
});
var paymentsRelations = relations(payments, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [payments.restaurantId],
    references: [restaurants.id]
  }),
  recordedByUser: one(users, {
    fields: [payments.recordedBy],
    references: [users.id]
  })
}));
var insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true
}).extend({
  amount: z.string().or(z.number())
});

// server/db.ts
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
config();
config({ path: ".env.cloud", quiet: true });
function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return normalizePostgresUrl(trimmed);
  }
  return void 0;
}
function normalizePostgresUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("uselibpqcompat")) parsed.searchParams.set("uselibpqcompat", "true");
    if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "require");
    return parsed.toString();
  } catch {
    return url;
  }
}
function resolveMigrationsFolder() {
  return path.resolve(process.cwd(), "migrations");
}
var databaseUrl = resolveDatabaseUrl();
var migrationsFolder = resolveMigrationsFolder();
var onVercel = process.env.VERCEL === "1";
var usingRemoteDatabase = Boolean(databaseUrl);
var pool;
var db;
var initializeDatabase;
if (databaseUrl) {
  const ssl = onVercel || /supabase\.co|sslmode=require/i.test(databaseUrl) ? { rejectUnauthorized: false } : void 0;
  const pgPool = new pg.Pool({
    connectionString: databaseUrl,
    ssl,
    // Serverless: keep the pool tiny so cold starts do not exhaust Supabase slots.
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: onVercel ? 5e3 : 3e4,
    connectionTimeoutMillis: 15e3
  });
  const remote = drizzlePg(pgPool, { schema: schema_exports });
  pool = { close: () => pgPool.end() };
  db = remote;
  initializeDatabase = async () => {
    await pgPool.query("select 1");
    const runMigrate = !onVercel || process.env.RUN_MIGRATE_ON_BOOT === "true";
    if (!runMigrate) return;
    try {
      await migratePg(remote, { migrationsFolder });
    } catch (error) {
      console.error("Drizzle migrate failed on boot", {
        type: error?.name,
        message: error?.message,
        migrationsFolder
      });
      throw error;
    }
  };
} else {
  let localReady = null;
  initializeDatabase = async () => {
    if (onVercel) {
      throw new Error(
        "Postgres URL missing on Vercel. Set DATABASE_URL, or connect Supabase so POSTGRES_URL_NON_POOLING / POSTGRES_URL exist. PGlite is local-only."
      );
    }
    if (!localReady) {
      localReady = (async () => {
        const localModule = ["./dbPglite", ""].join("");
        const { initPgliteDatabase } = await import(localModule);
        const local = await initPgliteDatabase(migrationsFolder);
        pool = local.pool;
        db = local.db;
      })();
    }
    await localReady;
  };
  pool = { close: async () => {
  } };
  db = null;
}
function databaseEnvProbe() {
  return {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL?.trim()),
    hasPostgresNonPooling: Boolean(process.env.POSTGRES_URL_NON_POOLING?.trim()),
    usingRemoteDatabase,
    sessionSecretOk: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 48),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    publicUrl: process.env.PUBLIC_URL?.trim() || null
  };
}

// server/apiApplication.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { eq, sql as sql2 } from "drizzle-orm";

// server/passwords.ts
import { default as default2 } from "bcryptjs";

// server/storage.ts
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(sql2`lower(${users.email}) = ${email.trim().toLowerCase()}`);
    return user;
  }
  async getUserById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async updateUserPassword(userId, hashedPassword) {
    await db.update(users).set({ password: hashedPassword, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  }
  async createUser(userData) {
    const hashedPassword = await default2.hash(userData.password, 10);
    const [user] = await db.insert(users).values({
      ...userData,
      password: hashedPassword
    }).returning();
    return user;
  }
  async deleteUser(id) {
    await db.delete(users).where(eq(users.id, id));
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  async updateUser(id, userData) {
    const updateData = { ...userData };
    if (updateData.password) {
      updateData.password = await default2.hash(updateData.password, 10);
    }
    const [user] = await db.update(users).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async getRestaurantByUserId(userId) {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.userId, userId)).limit(1);
    return restaurant;
  }
  async getRestaurantById(id) {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }
  async createRestaurant(restaurant) {
    const [existing] = await db.select().from(restaurants).where(eq(restaurants.userId, restaurant.userId)).limit(1);
    if (existing) {
      const [updated] = await db.update(restaurants).set({ ...restaurant, updatedAt: /* @__PURE__ */ new Date() }).where(eq(restaurants.id, existing.id)).returning();
      return updated;
    }
    const [newRestaurant] = await db.insert(restaurants).values(restaurant).returning();
    return newRestaurant;
  }
  async updateRestaurant(id, restaurant) {
    const [updated] = await db.update(restaurants).set({ ...restaurant, updatedAt: /* @__PURE__ */ new Date() }).where(eq(restaurants.id, id)).returning();
    return updated;
  }
  async getAllRestaurants() {
    return await db.select().from(restaurants);
  }
  async deleteRestaurant(id) {
    await db.delete(restaurants).where(eq(restaurants.id, id));
  }
  async getCategoriesByRestaurantId(restaurantId) {
    return await db.select().from(categories).where(eq(categories.restaurantId, restaurantId)).orderBy(categories.order, categories.id);
  }
  async createCategory(category) {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }
  async updateCategory(id, category) {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated;
  }
  async deleteCategory(id) {
    await db.delete(categories).where(eq(categories.id, id));
  }
  async getMenuItemsByRestaurantId(restaurantId) {
    const result = await db.select({
      menuItem: menuItems
    }).from(menuItems).innerJoin(categories, eq(menuItems.categoryId, categories.id)).where(eq(categories.restaurantId, restaurantId)).orderBy(menuItems.order, menuItems.id);
    return result.map((r) => r.menuItem);
  }
  async getMenuItemsByCategoryId(categoryId) {
    return await db.select().from(menuItems).where(eq(menuItems.categoryId, categoryId)).orderBy(menuItems.order, menuItems.id);
  }
  async createMenuItem(item) {
    const itemData = {
      ...item,
      price: typeof item.price === "number" ? String(item.price) : item.price,
      discount: item.discount !== void 0 ? typeof item.discount === "number" ? String(item.discount) : item.discount : void 0
    };
    const [newItem] = await db.insert(menuItems).values(itemData).returning();
    return newItem;
  }
  async updateMenuItem(id, item) {
    const itemData = { ...item, updatedAt: /* @__PURE__ */ new Date() };
    if (item.price !== void 0) {
      itemData.price = typeof item.price === "number" ? String(item.price) : item.price;
    }
    if (item.discount !== void 0) {
      itemData.discount = typeof item.discount === "number" ? String(item.discount) : item.discount;
    }
    const [updated] = await db.update(menuItems).set(itemData).where(eq(menuItems.id, id)).returning();
    return updated;
  }
  async deleteMenuItem(id) {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  }
  async getPriceVariantsByMenuItemId(menuItemId) {
    return await db.select().from(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, menuItemId)).orderBy(menuItemPriceVariants.order, menuItemPriceVariants.id);
  }
  async getPriceVariantsByRestaurantId(restaurantId) {
    const result = await db.select({
      variant: menuItemPriceVariants
    }).from(menuItemPriceVariants).innerJoin(menuItems, eq(menuItemPriceVariants.menuItemId, menuItems.id)).innerJoin(categories, eq(menuItems.categoryId, categories.id)).where(eq(categories.restaurantId, restaurantId)).orderBy(menuItemPriceVariants.order, menuItemPriceVariants.menuItemId, menuItemPriceVariants.id);
    return result.map((r) => r.variant);
  }
  async createPriceVariant(variant) {
    const variantData = {
      ...variant,
      price: typeof variant.price === "number" ? String(variant.price) : variant.price,
      discount: variant.discount !== void 0 ? typeof variant.discount === "number" ? String(variant.discount) : variant.discount : void 0
    };
    const [newVariant] = await db.insert(menuItemPriceVariants).values(variantData).returning();
    return newVariant;
  }
  async updatePriceVariant(id, variant) {
    const variantData = { ...variant };
    if (variant.price !== void 0) {
      variantData.price = typeof variant.price === "number" ? String(variant.price) : variant.price;
    }
    if (variant.discount !== void 0) {
      variantData.discount = typeof variant.discount === "number" ? String(variant.discount) : variant.discount;
    }
    const [updated] = await db.update(menuItemPriceVariants).set(variantData).where(eq(menuItemPriceVariants.id, id)).returning();
    return updated;
  }
  async deletePriceVariant(id) {
    await db.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.id, id));
  }
  async deletePriceVariantsByMenuItemId(menuItemId) {
    await db.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, menuItemId));
  }
  async replacePriceVariants(menuItemId, variants) {
    return await db.transaction(async (tx) => {
      await tx.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, menuItemId));
      if (variants.length === 0) {
        return [];
      }
      const sanitizedVariants = variants.map((variant) => ({
        ...variant,
        menuItemId,
        price: typeof variant.price === "number" ? String(variant.price) : variant.price,
        discount: variant.discount !== void 0 ? typeof variant.discount === "number" ? String(variant.discount) : variant.discount : "0"
      }));
      const createdVariants = await tx.insert(menuItemPriceVariants).values(sanitizedVariants).returning();
      return createdVariants;
    });
  }
};
var storage = new DatabaseStorage();

// server/localAuth.ts
import session from "express-session";
import { eq as eq2, lt } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

// server/securityHeaders.ts
var CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
function securityHeaders(production, https) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    ...production ? { "Content-Security-Policy": CONTENT_SECURITY_POLICY } : {},
    ...production && https ? { "Strict-Transport-Security": "max-age=31536000" } : {}
  };
}
function safeError(error) {
  const value = error;
  return { type: value?.name || "Error", code: value?.code || value?.cause?.code };
}

// server/httpSecurity.ts
function trustProxyEnabled() {
  if (process.env.TRUST_PROXY === "true") return true;
  if (process.env.TRUST_PROXY === "false") return false;
  return process.env.VERCEL === "1";
}
function mountHttpSecurity(app) {
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxyEnabled() ? 1 : false);
  app.use((req, res, next) => {
    res.set(securityHeaders(process.env.NODE_ENV === "production", req.secure));
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("Origin");
    const expected = `${req.protocol}://${req.get("host")}`;
    const site = req.get("Sec-Fetch-Site");
    if (site && !["same-origin", "none"].includes(site) || origin && origin !== expected) {
      return res.status(403).json({ message: "Requests must come from this application" });
    }
    next();
  });
}
var rateLimitScope = 0;
function rateLimit(limit, windowMs, key, skipSuccessful = false) {
  const scope = `${++rateLimitScope}:${limit}:${windowMs}`;
  const buckets = /* @__PURE__ */ new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    buckets.forEach((b, k) => {
      if (b.reset <= now) buckets.delete(k);
    });
  }, Math.min(windowMs, 6e4));
  cleanup.unref();
  return (req, res, next) => {
    const now = Date.now(), id = `${scope}:${key(req)}`;
    let bucket = buckets.get(id);
    if (!bucket || bucket.reset <= now) {
      if (buckets.size >= 1e4) return res.status(429).set("Retry-After", "60").json({ message: "Too many requests. Try again shortly." });
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(id, bucket);
    }
    if (++bucket.count > limit) return res.status(429).set("Retry-After", String(Math.ceil((bucket.reset - now) / 1e3))).json({ message: "Too many attempts. Try again shortly." });
    if (skipSuccessful) res.once("finish", () => {
      if (res.statusCode < 400 && buckets.get(id) === bucket) buckets.delete(id);
    });
    next();
  };
}

// server/localAuth.ts
function cookieSecureEnabled() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.VERCEL === "1";
}
function sessionCookieName() {
  return cookieSecureEnabled() ? "__Host-cafe.sid" : "connect.sid";
}
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  class DatabaseSessionStore extends session.Store {
    get(sid, callback) {
      db.select().from(sessions).where(eq2(sessions.sid, sid)).then(([row]) => callback(null, row && row.expire > /* @__PURE__ */ new Date() ? row.sess : null)).catch(callback);
    }
    set(sid, data, callback) {
      const expire = new Date(data.cookie.expires || Date.now() + sessionTtl);
      db.insert(sessions).values({ sid, sess: data, expire }).onConflictDoUpdate({ target: sessions.sid, set: { sess: data, expire } }).then(() => callback?.()).catch((err) => callback?.(err));
    }
    destroy(sid, callback) {
      db.delete(sessions).where(eq2(sessions.sid, sid)).then(() => callback?.()).catch((err) => callback?.(err));
    }
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 48) throw new Error("Configure a session secret of at least 48 characters");
  const sessionStore = new DatabaseSessionStore();
  db.delete(sessions).where(lt(sessions.expire, /* @__PURE__ */ new Date())).catch((error) => console.error("Session cleanup failed", safeError(error)));
  return session({
    name: sessionCookieName(),
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecureEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtl
    }
  });
}
async function setupAuth(app) {
  app.use(getSession());
  const ipLimit = rateLimit(100, 15 * 60 * 1e3, (req) => req.ip || "unknown");
  const accountLimit = rateLimit(10, 15 * 60 * 1e3, (req) => String(req.body?.email || "").trim().toLowerCase().slice(0, 254), true);
  app.post("/api/login", ipLimit, accountLimit, async (req, res) => {
    try {
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      const { email, password } = validationResult.data;
      const user = await storage.getUserByEmail(email);
      if (!user || user.accountStatus !== "active" || !["admin", "super_admin"].includes(user.role)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const isValidPassword = await default2.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
      req.session.userId = user.id;
      await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      const { password: _, ...sanitizedUser } = user;
      res.json({
        success: true,
        user: sanitizedUser
      });
    } catch (error) {
      console.error("Login error:", safeError(error));
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie(sessionCookieName(), { path: "/", httpOnly: true, secure: cookieSecureEnabled(), sameSite: "lax" });
      res.json({ success: true });
    });
  });
}
var isAuthenticated = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const user = req.user?.id === userId ? req.user : await storage.getUser(userId);
    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!["admin", "super_admin"].includes(user.role)) return res.status(403).json({ message: "This account has no management role" });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};
var isSuperAdmin = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const user = req.user?.id === userId ? req.user : await storage.getUser(userId);
    if (!user || user.accountStatus !== "active" || user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Super admin access required" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// server/localObjects.ts
import express from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";

// server/accessControl.ts
import { desc } from "drizzle-orm";
import { z as z2 } from "zod";

// server/requestTasks.ts
function deferRequestTask(task) {
  return task.catch((error) => console.error("Deferred request task failed", { type: error?.name, code: error?.code }));
}

// server/accessControl.ts
async function getManagedCafe(req) {
  if (req.managedCafeResolved) return req.managedCafe;
  const cafe = req.user.role === "super_admin" ? req.session.cafeId ? await storage.getRestaurantById(req.session.cafeId) : void 0 : await storage.getRestaurantByUserId(req.user.id);
  req.managedCafe = cafe;
  req.managedCafeResolved = true;
  return cafe;
}
async function mediaOwner(req) {
  return (await getManagedCafe(req))?.userId || req.user.id;
}
async function authUser(req) {
  const { password, ...user } = req.user;
  const cafe = await getManagedCafe(req);
  const owner = cafe ? cafe.userId === req.user.id ? req.user : await storage.getUser(cafe.userId) : void 0;
  return { ...user, cafeContext: cafe ? {
    id: cafe.id,
    name: cafe.name,
    theme: cafe.theme,
    owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null
  } : null };
}
var publicGet = /^\/api\/(?:cafes$|(?:menu|restaurant|categories|menu-items)\/public\/[^/]+$|price-variants\/public\/(?:[^/]+|restaurant\/[^/]+)$)/;
var cafePath = /^\/api\/(?:restaurant|categories|menu-items|price-variants|manager-menu|category-order|cafe-backup|cafe-menu|admin\/menu-design|objects\/upload)(?:\/|$)/;
var sharedPath = /^\/api\/(?:auth\/user|account\/password|menu-library)(?:\/|$)/;
function mountAccessControl(app) {
  app.use(async (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (["GET", "HEAD"].includes(req.method) && publicGet.test(req.path)) return next();
    isAuthenticated(req, res, async (error) => {
      if (error) return next(error);
      try {
        const actor = req.user;
        if (!["admin", "super_admin"].includes(actor.role)) return res.status(403).json({ message: "This account has no management role" });
        const requestPath = req.path;
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
          res.once("finish", () => {
            const candidate = req.platformCafe?.id || req.managedCafe?.id || (requestPath === "/api/super-admin/cafe-access" ? req.session?.cafeId || req.body?.restaurantId : null) || (requestPath.startsWith("/api/menu-library/") ? req.body?.restaurantId : null);
            const cafeId = typeof candidate === "string" && z2.string().uuid().safeParse(candidate).success ? candidate : null;
            deferRequestTask((async () => {
              const affected = req.platformCafe || req.managedCafe || (cafeId ? await storage.getRestaurantById(cafeId) : void 0);
              await db.insert(accessAudit).values({
                actorId: actor.id,
                actorEmail: actor.email,
                actorRole: actor.role,
                cafeId,
                cafeName: affected?.name || null,
                action: `${req.method} ${requestPath}`,
                status: res.statusCode
              });
            })());
          });
        }
        if (requestPath.startsWith("/api/super-admin/")) {
          if (actor.role !== "super_admin") return res.status(403).json({ message: "Super admin access required" });
          return next();
        }
        if (sharedPath.test(requestPath)) return next();
        if (!cafePath.test(requestPath)) return res.status(404).json({ message: "API route not found" });
        const cafe = await getManagedCafe(req);
        if (actor.role === "super_admin" && !cafe) return res.status(409).json({ message: "Open a caf\xE9 workspace from the platform dashboard first" });
        const expected = req.get("X-Cafe-Context");
        if (expected && expected !== cafe?.id || actor.role === "super_admin" && !["GET", "HEAD"].includes(req.method) && expected !== cafe?.id) {
          return res.status(409).json({ message: "The caf\xE9 workspace changed. Reload before saving." });
        }
        next();
      } catch (e) {
        next(e);
      }
    });
  });
  app.post("/api/super-admin/cafe-access", isSuperAdmin, async (req, res, next) => {
    try {
      const { restaurantId } = z2.object({ restaurantId: z2.string().uuid() }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(restaurantId);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      const owner = await storage.getUser(cafe.userId);
      if (!owner || !["admin", "super_admin"].includes(owner.role)) return res.status(409).json({ message: "This caf\xE9 needs a valid manager account" });
      req.session.cafeId = cafe.id;
      await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      req.managedCafe = cafe;
      req.managedCafeResolved = true;
      res.json(await authUser(req));
    } catch (e) {
      next(e);
    }
  });
  app.delete("/api/super-admin/cafe-access", isSuperAdmin, async (req, res, next) => {
    try {
      const previousId = req.session.cafeId;
      delete req.session.cafeId;
      await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      req.managedCafe = previousId ? await storage.getRestaurantById(previousId) : void 0;
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/super-admin/access-audit", isSuperAdmin, async (_req, res, next) => {
    try {
      res.json(await db.select().from(accessAudit).orderBy(desc(accessAudit.createdAt)).limit(200));
    } catch (e) {
      next(e);
    }
  });
}

// server/mediaStore.ts
import fs from "node:fs/promises";
import path2 from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { eq as eq3 } from "drizzle-orm";
var root = path2.resolve("data/uploads");
var supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
var serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var storageBucket = process.env.STORAGE_BUCKET || "cafe-media";
var useSupabaseStorage = usingRemoteDatabase && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl) && Boolean(serviceRole);
function storageRequest(apiPath, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${serviceRole}`);
  headers.set("apikey", serviceRole);
  return fetch(`${supabaseUrl}/storage/v1/${apiPath}`, {
    ...options,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(2e4)
  });
}
function objectPath(id) {
  return `${encodeURIComponent(storageBucket)}/${id}`;
}
async function deleteStorageObject(id) {
  const response = await storageRequest(`object/${encodeURIComponent(storageBucket)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [id] })
  });
  if (!response.ok) throw new Error("Unable to remove photo");
}
async function putLocal(id, body, owner, mime) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path2.join(root, id), body, { flag: "wx" });
  try {
    await fs.writeFile(path2.join(root, id + ".json"), JSON.stringify({ owner, mime }), { flag: "wx" });
  } catch (error) {
    await fs.unlink(path2.join(root, id));
    throw error;
  }
}
async function getLocal(id) {
  const meta = JSON.parse(await fs.readFile(path2.join(root, id + ".json"), "utf8"));
  return { id, owner: meta.owner, mime: meta.mime, filename: path2.join(root, id) };
}
async function copyLocal(source, id, owner) {
  await fs.copyFile(source.filename, path2.join(root, id), 1);
  try {
    await fs.writeFile(path2.join(root, id + ".json"), JSON.stringify({ owner, mime: source.mime }), { flag: "wx" });
  } catch (error) {
    await fs.unlink(path2.join(root, id));
    throw error;
  }
}
async function removeLocal(id) {
  await Promise.allSettled([fs.unlink(path2.join(root, id)), fs.unlink(path2.join(root, id + ".json"))]);
}
async function sendLocal(file, res) {
  res.setHeader("Content-Type", file.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(file.filename);
}
async function putRemote(id, body, owner, mime) {
  const response = await storageRequest(`object/${objectPath(id)}`, {
    method: "POST",
    body: new Uint8Array(body),
    headers: { "Content-Type": mime, "x-upsert": "false", "Cache-Control": "3600" }
  });
  if (response.status === 409 || response.status === 400 && (await response.clone().text()).includes("Duplicate")) {
    throw Object.assign(new Error("Upload already exists"), { code: "EEXIST" });
  }
  if (!response.ok) throw new Error("Media upload unavailable");
  try {
    await db.insert(mediaObjects).values({ id, ownerId: owner, mime, size: body.length });
  } catch (error) {
    await deleteStorageObject(id);
    throw error;
  }
}
async function getRemote(id) {
  const [meta] = await db.select().from(mediaObjects).where(eq3(mediaObjects.id, id));
  if (!meta) throw Object.assign(new Error("Media not found"), { status: 404, code: "ENOENT" });
  return { id, owner: meta.ownerId, mime: meta.mime };
}
async function copyRemote(source, id, owner) {
  const response = await storageRequest("object/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: storageBucket, sourceKey: source.id, destinationKey: id })
  });
  if (!response.ok) throw new Error("Unable to copy menu photo");
  try {
    const [meta] = await db.select().from(mediaObjects).where(eq3(mediaObjects.id, source.id));
    if (!meta) throw new Error("Source photo not found");
    await db.insert(mediaObjects).values({ id, ownerId: owner, mime: source.mime, size: meta.size });
  } catch (error) {
    await deleteStorageObject(id);
    throw error;
  }
}
async function removeRemote(id) {
  await deleteStorageObject(id);
  await db.delete(mediaObjects).where(eq3(mediaObjects.id, id));
}
async function sendRemote(file, res) {
  const range = res.req.get("Range");
  const response = await storageRequest(`object/authenticated/${objectPath(file.id)}`, {
    headers: range ? { Range: range } : {}
  });
  if (![200, 206, 304, 416].includes(response.status)) {
    throw Object.assign(new Error("Photo unavailable"), { status: response.status === 404 ? 404 : 503 });
  }
  res.status(response.status);
  res.set({
    "Content-Type": file.mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes"
  });
  for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
    const value = response.headers.get(name);
    if (value) res.set(name, value);
  }
  if (!response.body || res.req.method === "HEAD") {
    await response.body?.cancel();
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
}
async function putMedia(id, body, owner, mime) {
  return useSupabaseStorage ? putRemote(id, body, owner, mime) : putLocal(id, body, owner, mime);
}
async function getMedia(id) {
  return useSupabaseStorage ? getRemote(id) : getLocal(id);
}
async function copyMedia(source, id, owner) {
  return useSupabaseStorage ? copyRemote(source, id, owner) : copyLocal(source, id, owner);
}
async function removeMedia(id) {
  return useSupabaseStorage ? removeRemote(id) : removeLocal(id);
}
async function sendMedia(file, res) {
  return useSupabaseStorage ? sendRemote(file, res) : sendLocal(file, res);
}
var usingSupabaseMedia = useSupabaseStorage;

// server/localObjects.ts
function imageDimensionsValid(body, mime) {
  const sizeOK = (w, h) => w > 0 && h > 0 && w <= 12e3 && h <= 12e3 && w * h <= 4e7;
  if (mime === "image/png") return body.length >= 45 && body.subarray(12, 16).toString() === "IHDR" && body.subarray(-8, -4).toString() === "IEND" && sizeOK(body.readUInt32BE(16), body.readUInt32BE(20));
  if (mime === "image/gif") return body.length >= 14 && body[body.length - 1] === 59 && sizeOK(body.readUInt16LE(6), body.readUInt16LE(8));
  if (mime === "image/webp") {
    if (body.length < 30 || body.readUInt32LE(4) + 8 !== body.length) return false;
    let imageFound = false;
    for (let offset = 12; offset < body.length; ) {
      if (offset + 8 > body.length) return false;
      const kind = body.subarray(offset, offset + 4).toString();
      const length = body.readUInt32LE(offset + 4), start = offset + 8;
      if (start + length + length % 2 > body.length) return false;
      if (kind === "VP8X" && (length !== 10 || !sizeOK(body.readUIntLE(start + 4, 3) + 1, body.readUIntLE(start + 7, 3) + 1))) return false;
      if (kind === "VP8 ") {
        if (length < 10 || !body.subarray(start + 3, start + 6).equals(Buffer.from([157, 1, 42])) || !sizeOK(body.readUInt16LE(start + 6) & 16383, body.readUInt16LE(start + 8) & 16383)) return false;
        imageFound = true;
      }
      if (kind === "VP8L") {
        if (length < 5 || body[start] !== 47) return false;
        const packed = body.readUInt32LE(start + 1);
        if (!sizeOK((packed & 16383) + 1, (packed >>> 14 & 16383) + 1)) return false;
        imageFound = true;
      }
      if (kind === "ANMF") {
        if (length < 24) return false;
        imageFound = true;
      }
      offset = start + length + length % 2;
    }
    return imageFound;
  }
  if (mime === "image/jpeg") {
    if (body.length < 20 || body[body.length - 2] !== 255 || body[body.length - 1] !== 217) return false;
    for (let i = 2; i + 9 < body.length; ) {
      if (body[i] !== 255) return false;
      const marker = body[i + 1];
      if (marker === 255) {
        i++;
        continue;
      }
      if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) return sizeOK(body.readUInt16BE(i + 7), body.readUInt16BE(i + 5));
      if ([216, 217, 1].includes(marker) || marker >= 208 && marker <= 215) {
        i += 2;
        continue;
      }
      const length = body.readUInt16BE(i + 2);
      if (length < 2 || i + length + 2 > body.length) return false;
      i += length + 2;
    }
    return false;
  }
  return body.length >= 16 && body.readUInt32BE(0) >= 12 && body.readUInt32BE(0) <= body.length;
}
var ObjectNotFoundError = class extends Error {
};
function token(id, owner, actor, version, expiry) {
  return createHmac("sha256", process.env.SESSION_SECRET).update(`${id}:${owner}:${actor}:${version}:${expiry}`).digest("hex");
}
function signedUploadURL(owner, actor) {
  const id = randomUUID(), expiry = Date.now() + 6e5;
  const version = actor.updatedAt?.getTime() || 0;
  return `/objects/${id}?owner=${owner}&actor=${actor.id}&version=${version}&expiry=${expiry}&token=${token(id, owner, actor.id, version, expiry)}`;
}
function mountLocalUploads(app) {
  app.post("/api/objects/upload", rateLimit(100, 60 * 60 * 1e3, (req) => req.user?.id || req.ip), async (req, res, next) => {
    try {
      const owner = await mediaOwner(req);
      res.json({ uploadURL: signedUploadURL(owner, req.user) });
    } catch (e) {
      next(e);
    }
  });
  app.put("/objects/:id", async (req, res, next) => {
    try {
      const { owner, actor, version, expiry, token: signature } = req.query;
      if (!/^[a-f0-9-]{36}$/.test(req.params.id) || typeof owner !== "string" || typeof actor !== "string" || !Number.isFinite(Number(version)) || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature) || Number(expiry) < Date.now() || !Number.isFinite(Number(expiry))) return res.sendStatus(403);
      const expected = token(req.params.id, owner, actor, Number(version), Number(expiry));
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.sendStatus(403);
      if (!await storage.getUser(owner)) return res.sendStatus(403);
      const uploader = await storage.getUser(actor);
      if (!uploader || uploader.accountStatus !== "active" || !["admin", "super_admin"].includes(uploader.role) || (uploader.updatedAt?.getTime() || 0) !== Number(version)) return res.sendStatus(403);
      next();
    } catch (error) {
      next(error);
    }
  }, express.raw({ type: () => true, limit: "5mb" }), async (req, res, next) => {
    try {
      const owner = req.query.owner;
      const body = req.body;
      if (!Buffer.isBuffer(body) || !body.length) return res.status(400).json({ message: "Upload a media file" });
      let mime = "";
      if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = "image/png";
      else if (body[0] === 255 && body[1] === 216 && body[2] === 255) mime = "image/jpeg";
      else if (/^GIF8[79]a$/.test(body.subarray(0, 6).toString())) mime = "image/gif";
      else if (body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP") mime = "image/webp";
      else if (body.subarray(4, 8).toString() === "ftyp") mime = "video/mp4";
      else if (body.subarray(0, 4).toString() === "glTF") mime = "model/gltf-binary";
      if (!mime) return res.status(400).json({ message: "Use PNG, JPEG, GIF, WebP, MP4, or GLB media" });
      if (mime !== "model/gltf-binary" && !imageDimensionsValid(body, mime)) return res.status(400).json({ message: "This media file is incomplete or too large in dimensions. Choose another file." });
      await putMedia(req.params.id, body, owner, mime);
      res.json({ success: true });
    } catch (error) {
      if (error.code === "EEXIST") return res.status(409).json({ message: "This upload was already completed" });
      next(error);
    }
  });
}
var ObjectStorageService = class {
  async mediaType(url, imageOnly = false) {
    const file = await this.getObjectEntityFile(url);
    if (imageOnly && !file.mime.startsWith("image/")) throw Object.assign(new Error("Choose an image for this field"), { status: 400 });
    return file.mime === "video/mp4" ? "video" : file.mime === "image/gif" ? "gif" : "image";
  }
  async copyForOwner(url, owner) {
    const source = await this.getObjectEntityFile(url);
    const id = randomUUID();
    await copyMedia(source, id, owner);
    return `/objects/${id}`;
  }
  async removeCopiedObject(url) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new Error("Invalid object path");
    const id = url.split("/").pop();
    await removeMedia(id);
  }
  async trySetObjectEntityAclPolicy(url, policy) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new Error("Upload media before saving");
    const meta = await getMedia(url.split("/").pop());
    if (meta.owner !== policy.owner) throw new Error("Media belongs to another account");
    return url;
  }
  async getObjectEntityFile(url) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new ObjectNotFoundError();
    const id = url.split("/").pop();
    try {
      return await getMedia(id);
    } catch (error) {
      if (error.code === "ENOENT" || error.status === 404) throw new ObjectNotFoundError();
      throw error;
    }
  }
  async downloadObject(file, res) {
    await sendMedia(file, res);
  }
  async getObjectEntityUploadURL() {
    throw new Error("Use local upload endpoint");
  }
  async searchPublicObject(_path) {
    return void 0;
  }
};

// server/cafeControls.ts
import { eq as eq5, and, ne, sql as sql3 } from "drizzle-orm";
import { z as z5 } from "zod";

// server/pricingControls.ts
import { eq as eq4 } from "drizzle-orm";
import { z as z3 } from "zod";
var conflict = (message) => Object.assign(new Error(message), { status: 400 });
var optionsSchema = z3.array(insertPriceVariantSchema.omit({ menuItemId: true })).max(3).refine((v) => new Set(v.map((o) => o.label.toLowerCase())).size === v.length, "Price option labels must be unique");
function mountPricingControls(app) {
  app.post("/api/menu-items", async (req, res, next) => {
    try {
      const data = insertMenuItemSchema.parse(req.body);
      if (data.hasMultiplePricing) throw conflict("Use the complete menu editor to add price options");
      const [item] = await db.insert(menuItems).values({ ...data, price: String(data.price), discount: String(data.discount || 0) }).returning();
      res.json(item);
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/menu-items/:id", async (req, res, next) => {
    if (req.params.id === "image") return next();
    try {
      const data = insertMenuItemSchema.partial().parse(req.body);
      if (!Object.keys(data).length) throw conflict("Choose a menu field to update");
      const item = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(menuItems).where(eq4(menuItems.id, req.params.id)).for("update");
        if (!current) throw Object.assign(new Error("Item not found"), { status: 404 });
        if (data.hasMultiplePricing !== void 0 && data.hasMultiplePricing !== current.hasMultiplePricing) throw conflict("Use the complete menu editor to change price options");
        const [updated] = await tx.update(menuItems).set({
          ...data,
          price: data.price === void 0 ? void 0 : String(data.price),
          discount: data.discount === void 0 ? void 0 : String(data.discount),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(menuItems.id, current.id)).returning();
        return updated;
      });
      res.json(item);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/menu-items/:id/price-variants", async (req, res, next) => {
    try {
      const options = optionsSchema.parse(req.body);
      const result = await db.transaction(async (tx) => {
        const [item] = await tx.select().from(menuItems).where(eq4(menuItems.id, req.params.id)).for("update");
        if (!item) throw Object.assign(new Error("Item not found"), { status: 404 });
        await tx.delete(menuItemPriceVariants).where(eq4(menuItemPriceVariants.menuItemId, item.id));
        const created = options.length ? await tx.insert(menuItemPriceVariants).values(options.map((v, order) => ({ ...v, menuItemId: item.id, price: String(v.price), discount: String(v.discount || 0), order }))).returning() : [];
        await tx.update(menuItems).set({
          hasMultiplePricing: !!options.length,
          ...options.length ? { price: String(Math.min(...options.map((v) => Number(v.price)))) } : {},
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(menuItems.id, item.id));
        return created;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
  for (const method of ["post", "put", "delete"]) app[method](method === "post" ? "/api/price-variants" : "/api/price-variants/:id", async (req, res, next) => {
    try {
      const data = method === "post" ? insertPriceVariantSchema.parse(req.body) : method === "put" ? insertPriceVariantSchema.omit({ menuItemId: true }).partial().parse(req.body) : void 0;
      const result = await db.transaction(async (tx) => {
        const [old] = method === "post" ? [] : await tx.select().from(menuItemPriceVariants).where(eq4(menuItemPriceVariants.id, req.params.id));
        const itemId = method === "post" ? data.menuItemId : old?.menuItemId;
        if (!itemId) throw Object.assign(new Error("Price option not found"), { status: 404 });
        const [item] = await tx.select().from(menuItems).where(eq4(menuItems.id, itemId)).for("update");
        if (!item?.hasMultiplePricing) throw conflict("Use the complete menu editor to enable price options");
        const options = await tx.select().from(menuItemPriceVariants).where(eq4(menuItemPriceVariants.menuItemId, itemId));
        if (old && !options.some((v) => v.id === old.id)) throw Object.assign(new Error("Price option not found"), { status: 404 });
        const nextOptions = method === "post" ? [...options, data] : method === "put" ? options.map((v) => v.id === old.id ? { ...v, ...data } : v) : options.filter((v) => v.id !== old.id);
        if (!nextOptions.length) throw conflict("Use the complete menu editor to switch to a single price");
        optionsSchema.parse(nextOptions.map((v) => ({ label: v.label, price: v.price, discount: v.discount || "0", unit: v.unit })));
        const values = data ? { ...data, price: data.price === void 0 ? void 0 : String(data.price), discount: data.discount === void 0 ? void 0 : String(data.discount) } : {};
        const [updated] = method === "post" ? await tx.insert(menuItemPriceVariants).values({ ...values, menuItemId: itemId }).returning() : method === "put" ? await tx.update(menuItemPriceVariants).set(values).where(eq4(menuItemPriceVariants.id, old.id)).returning() : await tx.delete(menuItemPriceVariants).where(eq4(menuItemPriceVariants.id, old.id)).returning();
        await tx.update(menuItems).set({ price: String(Math.min(...nextOptions.map((v) => Number(v.price)))), updatedAt: /* @__PURE__ */ new Date() }).where(eq4(menuItems.id, itemId));
        return method === "delete" ? { success: true } : updated;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
}

// shared/menuDesignSettings.ts
import { z as z4 } from "zod";
var arenaAssetUrl = z4.string().refine(
  (v) => /^\/objects\/[a-f0-9-]{36}$/i.test(v) || /^\/assets\/arena\/[A-Za-z0-9._\-/]+$/.test(v) || /^https:\/\//i.test(v),
  { message: "Use /objects/<uuid>, /assets/arena/\u2026, or an https URL" }
);
var arenaAssetUrlOrNull = z4.union([arenaAssetUrl, z4.null()]);
var hex = z4.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
var optStr = z4.string().max(500);
var optLong = z4.string().max(2e3);
var categoryOverride = z4.object({
  group: z4.enum(["food", "drinks"]).optional(),
  nameAr: z4.string().max(200).optional(),
  hue: hex.optional(),
  bannerUrl: arenaAssetUrlOrNull.optional(),
  iconUrl: arenaAssetUrlOrNull.optional()
}).strict();
var groupOverride = z4.object({
  key: z4.enum(["food", "drinks"]).optional(),
  label: optStr.optional(),
  railLabel: optStr.optional(),
  bg: z4.object({ inner: hex.optional(), mid: hex.optional(), outer: hex.optional() }).strict().optional(),
  canTextureUrl: arenaAssetUrlOrNull.optional(),
  card: z4.object({
    label: optStr.optional(),
    countSuffix: optStr.optional(),
    imageUrl: arenaAssetUrlOrNull.optional(),
    imageAlt: optStr.optional()
  }).strict().optional(),
  floaters: z4.array(arenaAssetUrlOrNull).max(9).optional()
}).strict();
var menuDesignSettingsSchema = z4.object({
  version: z4.literal(1).optional(),
  seo: z4.object({ title: optStr.optional(), description: optLong.optional() }).strict().optional(),
  theme: z4.object({
    accent: hex.optional(),
    accentInk: hex.optional(),
    fontHeading: optStr.optional(),
    fontBody: optStr.optional(),
    fontArabic: optStr.optional()
  }).strict().optional(),
  brand: z4.object({
    logoUrl: arenaAssetUrlOrNull.optional(),
    logoAlt: optStr.optional(),
    socialLabel: optStr.optional(),
    socialUrl: z4.union([z4.string().url().max(500), z4.literal(""), z4.null()]).optional(),
    showSocial: z4.boolean().optional(),
    footerText: optStr.optional(),
    footerNote: optStr.optional(),
    currency: optStr.optional(),
    fallbackLogoUrl: arenaAssetUrlOrNull.optional()
  }).strict().optional(),
  hero: z4.object({
    titleLine1: optStr.optional(),
    titleLine2: optStr.optional(),
    description: optLong.optional(),
    ctaLabel: optStr.optional(),
    ctaIcon: optStr.optional(),
    showBadge: z4.boolean().optional(),
    badgeIcon: optStr.optional(),
    badgeTitle: optStr.optional(),
    badgeSubtitle: optStr.optional(),
    sideLine1: optStr.optional(),
    sideLine2: optStr.optional(),
    showScrollCue: z4.boolean().optional(),
    scrollCueLabel: optStr.optional()
  }).strict().optional(),
  groups: z4.array(groupOverride).max(2).optional(),
  product3d: z4.object({
    enabled: z4.boolean().optional(),
    modelUrl: arenaAssetUrlOrNull.optional(),
    alt: optStr.optional(),
    exposure: z4.number().min(0).max(5).optional(),
    tiltDeg: z4.number().min(-180).max(180).optional()
  }).strict().optional(),
  backFloaters: z4.array(z4.object({ imageUrl: arenaAssetUrlOrNull.optional(), enabled: z4.boolean().optional() }).strict()).max(4).optional(),
  bubbles: z4.object({
    enabled: z4.boolean().optional(),
    imageUrl: arenaAssetUrlOrNull.optional(),
    intervalMs: z4.number().int().min(50).max(1e4).optional()
  }).strict().optional(),
  marquee: z4.object({
    enabled: z4.boolean().optional(),
    mode: z4.enum(["categories", "custom"]).optional(),
    separator: optStr.optional(),
    customItems: z4.array(z4.string().max(100)).max(40).optional()
  }).strict().optional(),
  menuIntro: z4.object({ title: optStr.optional(), titleAr: optStr.optional(), subtitle: optLong.optional() }).strict().optional(),
  stats: z4.array(
    z4.object({
      key: z4.enum(["items", "categories", "minPrice"]).optional(),
      label: optStr.optional(),
      enabled: z4.boolean().optional()
    }).strict()
  ).max(3).optional(),
  filters: z4.object({ allLabel: optStr.optional(), showGroupFilter: z4.boolean().optional() }).strict().optional(),
  labels: z4.object({ itemsUpper: optStr.optional(), itemsLower: optStr.optional(), soldOut: optStr.optional() }).strict().optional(),
  effects: z4.object({
    reveal: z4.boolean().optional(),
    countUp: z4.boolean().optional(),
    tilt: z4.boolean().optional(),
    cursorRepel: z4.boolean().optional()
  }).strict().optional(),
  /** Per-category visual overrides keyed by category UUID. */
  categories: z4.record(z4.string().uuid(), categoryOverride).optional()
}).strict();
var menuDesignPutSchema = z4.object({
  enabled: z4.boolean().optional(),
  settings: menuDesignSettingsSchema.optional()
}).strict().refine((b) => b.enabled !== void 0 || b.settings !== void 0, {
  message: "Provide enabled and/or settings"
});

// server/cafeControls.ts
var profileFields = ["name", "theme", "currency", "timezone", "logoUrl", "coverMediaUrl", "coverMediaType", "cuisineType", "address", "phone", "openingHours"];
async function assertOwnedArenaAssets(cafeUserId, settings) {
  const media3 = new ObjectStorageService();
  const urls = [];
  const walk = (v) => {
    if (typeof v === "string" && /^\/objects\/[a-f0-9-]{36}$/i.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(settings);
  for (const url of urls) {
    try {
      await media3.trySetObjectEntityAclPolicy(url, { owner: cafeUserId, visibility: "public" });
    } catch {
      throw Object.assign(new Error("Choose media uploaded for this caf\xE9"), { status: 400 });
    }
  }
}
function mountCafeControls(app) {
  const guarded = async (req, res, next) => {
    try {
      if (req.path.startsWith("/api/super-admin") || !req.path.startsWith("/api/")) return next();
      const publicMatch = req.path.match(/^\/api\/(restaurant|categories|menu-items)\/public\/([^/]+)$/) || req.path.match(/^\/api\/price-variants\/public\/restaurant\/([^/]+)$/);
      if (publicMatch) {
        const id2 = publicMatch.length === 3 ? publicMatch[2] : publicMatch[1];
        const cafe2 = await storage.getRestaurantById(id2);
        if (!cafe2 || cafe2.hidden || cafe2.status !== "active") return res.status(404).json({ message: "Caf\xE9 unavailable" });
      }
      const variantPublic = req.path.match(/^\/api\/price-variants\/public\/([^/]+)$/);
      if (variantPublic) {
        const cafes = (await storage.getAllRestaurants()).filter((c) => !c.hidden && c.status === "active");
        let allowed = false;
        for (const cafe2 of cafes) if ((await storage.getMenuItemsByRestaurantId(cafe2.id)).some((i) => i.id === variantPublic[1] && i.isAvailable)) allowed = true;
        if (!allowed) return res.sendStatus(404);
      }
      const resource = req.path.match(/^\/api\/(restaurant|categories|menu-items|price-variants)(?:\/|$)/);
      if (!resource || req.path.includes("/public/")) return next();
      const user = req.user || await storage.getUser(req.session?.userId || "");
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      req.user = user;
      const cafe = await getManagedCafe(req);
      if (resource[1] === "restaurant") {
        if (req.method === "POST") {
          if (req.body.userId && req.body.userId !== (cafe?.userId || user.id)) return res.status(403).json({ message: "Caf\xE9 ownership cannot be changed here" });
          if (["role", "status", "hidden", "subscriptionStatus", "subscriptionPlan", "monthlyFee", "lastPaymentDate", "nextPaymentDue", "suspensionReason", "activeSince"].some((k) => k in req.body)) return res.status(403).json({ message: "Platform controls require the super admin dashboard" });
          if (Object.keys(req.body).some((k) => ![...profileFields, "userId", "expectedUpdatedAt"].includes(k))) return res.status(400).json({ message: "Unknown caf\xE9 profile field" });
          const picked = Object.fromEntries(profileFields.filter((k) => req.body[k] !== void 0).map((k) => [k, req.body[k]]));
          const parsed = cafeProfileSchema.parse(picked);
          for (const field of ["logoUrl", "coverMediaUrl"]) if (parsed[field]) {
            try {
              const media3 = new ObjectStorageService();
              await media3.trySetObjectEntityAclPolicy(String(parsed[field]), { owner: cafe?.userId || user.id, visibility: "public" });
              const kind = await media3.mediaType(String(parsed[field]), field !== "coverMediaUrl");
              if (field === "coverMediaUrl") parsed.coverMediaType = kind;
            } catch {
              return res.status(400).json({ message: "Choose media uploaded by your caf\xE9 account" });
            }
          }
          if ("coverMediaUrl" in parsed && !parsed.coverMediaUrl) parsed.coverMediaType = null;
          const expectedUpdatedAt = req.body.expectedUpdatedAt === void 0 ? void 0 : z5.string().datetime().parse(req.body.expectedUpdatedAt);
          req.body = { ...parsed, userId: cafe?.userId || user.id, expectedUpdatedAt };
        }
        return next();
      }
      if (!cafe) return res.status(404).json({ message: "Set up your caf\xE9 first" });
      const id = req.path.split("/")[3];
      const [cats, items, variants] = await Promise.all([
        req.body?.categoryId || resource[1] === "categories" && (id || ["POST", "PUT"].includes(req.method)) ? storage.getCategoriesByRestaurantId(cafe.id) : Promise.resolve([]),
        req.body?.menuItemId || id && (resource[1] === "menu-items" || resource[1] === "price-variants" && req.method === "GET") ? storage.getMenuItemsByRestaurantId(cafe.id) : Promise.resolve([]),
        id && resource[1] === "price-variants" && req.method !== "GET" ? storage.getPriceVariantsByRestaurantId(cafe.id) : Promise.resolve([])
      ]);
      if (resource[1] === "categories" && ["POST", "PUT"].includes(req.method)) {
        req.body.title = z5.string().trim().min(1).max(100).parse(req.body.title);
        if (cats.some((c) => c.id !== id && c.title.toLowerCase() === req.body.title.toLowerCase())) return res.status(400).json({ message: "A category with this name already exists" });
      }
      if (req.body?.restaurantId && req.body.restaurantId !== cafe.id) return res.sendStatus(403);
      if (req.body?.categoryId && !cats.some((c) => c.id === req.body.categoryId)) return res.sendStatus(403);
      if (req.body?.menuItemId && !items.some((i) => i.id === req.body.menuItemId)) return res.sendStatus(403);
      if (resource[1] === "menu-items" && ["POST", "PUT"].includes(req.method) && req.body?.imageUrl) {
        try {
          const media3 = new ObjectStorageService();
          await media3.trySetObjectEntityAclPolicy(req.body.imageUrl, { owner: cafe.userId, visibility: "public" });
          await media3.mediaType(req.body.imageUrl, true);
        } catch {
          return res.status(400).json({ message: "Choose a photo uploaded for this caf\xE9" });
        }
      }
      if (id && id !== "image") {
        const owned = resource[1] === "categories" ? cats.some((c) => c.id === id) : resource[1] === "menu-items" ? items.some((i) => i.id === id) : req.method === "GET" ? items.some((i) => i.id === id) : variants.some((v) => v.id === id);
        if (!owned) return res.status(404).json({ message: "Item not found" });
      }
      next();
    } catch (error) {
      if (error instanceof z5.ZodError) return res.status(400).json({ message: error.issues.map((i) => i.message).join(", ") });
      next(error);
    }
  };
  app.use(guarded);
  mountPricingControls(app);
  app.post("/api/restaurant", isAuthenticated, async (req, res, next) => {
    try {
      const { userId, expectedUpdatedAt, ...profile } = req.body;
      const data = cafeProfileSchema.parse(profile);
      const result = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(restaurants).where(eq5(restaurants.userId, userId)).for("update");
        if (current && expectedUpdatedAt && current.updatedAt?.getTime() !== new Date(expectedUpdatedAt).getTime()) throw Object.assign(new Error("This caf\xE9 profile changed after you opened it. Reload before saving."), { status: 409 });
        const [cafe] = current ? await tx.update(restaurants).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(restaurants.id, current.id)).returning() : await tx.insert(restaurants).values({ ...data, userId }).returning();
        return cafe;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/manager-menu", isAuthenticated, async (req, res, next) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) return res.json({ restaurant: null, categories: [], items: [], variants: [] });
      const [cats, items, variants] = await Promise.all([storage.getCategoriesByRestaurantId(restaurant.id), storage.getMenuItemsByRestaurantId(restaurant.id), storage.getPriceVariantsByRestaurantId(restaurant.id)]);
      res.json({ restaurant, categories: cats, items, variants });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/manager-menu", isAuthenticated, async (req, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.status(404).json({ message: "Set up your caf\xE9 first" });
      const data = insertMenuItemSchema.extend({ order: z5.number().int().min(0).optional() }).parse(req.body.item);
      if (data.imageUrl) {
        try {
          const media3 = new ObjectStorageService();
          await media3.trySetObjectEntityAclPolicy(data.imageUrl, { owner: await mediaOwner(req), visibility: "public" });
          await media3.mediaType(data.imageUrl, true);
        } catch {
          return res.status(400).json({ message: "Choose a photo uploaded by your caf\xE9 account" });
        }
      }
      const cats = await storage.getCategoriesByRestaurantId(cafe.id);
      if (!cats.some((c) => c.id === data.categoryId)) return res.status(403).json({ message: "Choose a category from your caf\xE9" });
      const id = req.body.id;
      if (id && !(await storage.getMenuItemsByRestaurantId(cafe.id)).some((i) => i.id === id)) return res.status(404).json({ message: "Item not found" });
      const options = z5.array(insertPriceVariantSchema.omit({ menuItemId: true })).max(3).parse(req.body.variants || []);
      if (data.hasMultiplePricing && !options.length) return res.status(400).json({ message: "Add at least one price option" });
      if (!data.hasMultiplePricing && options.length) return res.status(400).json({ message: "Enable multiple pricing to save price options" });
      if (new Set(options.map((v) => v.label.toLowerCase())).size !== options.length) return res.status(400).json({ message: "Price option labels must be unique" });
      const values = { ...data, price: String(data.price), discount: String(data.discount || 0) };
      const revision = req.body.expectedUpdatedAt === void 0 ? void 0 : z5.string().datetime().parse(req.body.expectedUpdatedAt);
      const result = await db.transaction(async (tx) => {
        if (id) {
          const [current] = await tx.select().from(menuItems).where(eq5(menuItems.id, id)).for("update");
          if (!current) throw Object.assign(new Error("Item not found"), { status: 404 });
          if (revision && current.updatedAt?.getTime() !== new Date(revision).getTime()) throw Object.assign(new Error("This item changed after you opened it. Close the editor, refresh, and try again."), { status: 409 });
        }
        const [item] = id ? await tx.update(menuItems).set({ ...values, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(menuItems.id, id)).returning() : await tx.insert(menuItems).values(values).returning();
        await tx.delete(menuItemPriceVariants).where(eq5(menuItemPriceVariants.menuItemId, item.id));
        const variants = options.length ? await tx.insert(menuItemPriceVariants).values(options.map((v, order) => ({ ...v, menuItemId: item.id, price: String(v.price), discount: String(v.discount || 0), order }))).returning() : [];
        return { ...item, variants };
      });
      res.json(result);
    } catch (e) {
      if (e instanceof z5.ZodError) return res.status(400).json({ message: e.issues.map((i) => i.message).join(", ") });
      next(e);
    }
  });
  app.put("/api/category-order", isAuthenticated, async (req, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      const ids = z5.array(z5.string()).parse(req.body.ids);
      const owned = await storage.getCategoriesByRestaurantId(cafe.id);
      if (ids.length !== owned.length || new Set(ids).size !== ids.length || ids.some((id) => !owned.some((c) => c.id === id))) return res.status(400).json({ message: "Order must contain every category from your caf\xE9 once" });
      await db.transaction(async (tx) => {
        for (let order = 0; order < ids.length; order++) await tx.update(categories).set({ order }).where(eq5(categories.id, ids[order]));
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/cafes", async (_req, res, next) => {
    try {
      res.json((await storage.getAllRestaurants()).filter((c) => c.status === "active" && !c.hidden).map(({ id, name, theme, cuisineType, logoUrl }) => ({ id, name, theme, cuisineType, logoUrl })));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/menu/public/:id", async (req, res, next) => {
    try {
      const id = z5.string().uuid().parse(req.params.id);
      const restaurant = await storage.getRestaurantById(id);
      if (!restaurant || restaurant.hidden || restaurant.status !== "active") return res.status(404).json({ message: "Caf\xE9 unavailable" });
      const [cats, allItems, allVariants, designRow] = await Promise.all([
        storage.getCategoriesByRestaurantId(id),
        storage.getMenuItemsByRestaurantId(id),
        storage.getPriceVariantsByRestaurantId(id),
        db.select().from(menuDesigns).where(eq5(menuDesigns.restaurantId, id)).limit(1).then((rows) => rows[0] ?? null)
      ]);
      const items = allItems.filter((item) => item.isAvailable);
      const visibleIds = new Set(items.map((item) => item.id));
      const { name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours } = restaurant;
      const settings = designRow?.settings && typeof designRow.settings === "object" && !Array.isArray(designRow.settings) ? designRow.settings : {};
      const design = { enabled: designRow ? designRow.enabled : true, settings };
      res.json({ restaurant: { id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours }, categories: cats, items, variants: allVariants.filter((v) => visibleIds.has(v.menuItemId)), design });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/categories/:id", isAuthenticated, async (req, res, next) => {
    try {
      res.json(await storage.updateCategory(req.params.id, z5.object({ title: z5.string().trim().min(1), order: z5.number().int().min(0).optional() }).parse(req.body)));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/cafe-backup", isAuthenticated, async (req, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      res.attachment("cafe-menu-backup.json").json({ version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), restaurant: cafe, categories: await storage.getCategoriesByRestaurantId(cafe.id), menuItems: await storage.getMenuItemsByRestaurantId(cafe.id), priceVariants: await storage.getPriceVariantsByRestaurantId(cafe.id) });
    } catch (e) {
      next(e);
    }
  });
  app.delete("/api/cafe-menu", isAuthenticated, async (req, res, next) => {
    try {
      if (req.body.confirmation !== "CLEAR MENU") return res.status(400).json({ message: "Type CLEAR MENU to confirm" });
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.sendStatus(404);
      await db.delete(categories).where(eq5(categories.restaurantId, cafe.id));
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/account/password", isAuthenticated, rateLimit(5, 15 * 60 * 1e3, (req) => req.user.id), async (req, res, next) => {
    try {
      const data = z5.object({ currentPassword: z5.string().max(72), newPassword: passwordSchema }).strict().parse(req.body);
      if (!await default2.compare(data.currentPassword, req.user.password)) return res.status(400).json({ message: "Current password is incorrect" });
      const password = await default2.hash(data.newPassword, 12);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ password, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(users.id, req.user.id));
        await tx.delete(sessions).where(and(sql3`${sessions.sess}->>'userId' = ${req.user.id}`, ne(sessions.sid, req.sessionID)));
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/menu-design", isAuthenticated, async (req, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.status(404).json({ message: "Set up your caf\xE9 first" });
      const row = (await db.select().from(menuDesigns).where(eq5(menuDesigns.restaurantId, cafe.id)).limit(1))[0];
      const settings = row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings) ? row.settings : {};
      res.json({
        restaurantId: cafe.id,
        enabled: row?.enabled ?? true,
        settings,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null
      });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/admin/menu-design", isAuthenticated, async (req, res, next) => {
    try {
      const cafe = await getManagedCafe(req);
      if (!cafe) return res.status(404).json({ message: "Set up your caf\xE9 first" });
      if (req.body?.restaurantId && req.body.restaurantId !== cafe.id) {
        return res.status(403).json({ message: "You can only edit your own caf\xE9 menu design" });
      }
      const body = menuDesignPutSchema.parse(req.body);
      if (body.settings) await assertOwnedArenaAssets(cafe.userId, body.settings);
      const existing = (await db.select().from(menuDesigns).where(eq5(menuDesigns.restaurantId, cafe.id)).limit(1))[0];
      const nextEnabled = body.enabled ?? existing?.enabled ?? true;
      const nextSettings = body.settings !== void 0 ? body.settings : existing?.settings && typeof existing.settings === "object" && !Array.isArray(existing.settings) ? existing.settings : {};
      const [row] = await db.insert(menuDesigns).values({
        restaurantId: cafe.id,
        enabled: nextEnabled,
        settings: nextSettings,
        updatedAt: /* @__PURE__ */ new Date(),
        updatedBy: req.user.id
      }).onConflictDoUpdate({
        target: menuDesigns.restaurantId,
        set: {
          enabled: nextEnabled,
          settings: nextSettings,
          updatedAt: /* @__PURE__ */ new Date(),
          updatedBy: req.user.id
        }
      }).returning();
      res.json({
        restaurantId: cafe.id,
        enabled: row.enabled,
        settings: row.settings,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy
      });
    } catch (e) {
      if (e instanceof z5.ZodError) return res.status(400).json({ message: e.issues.map((i) => i.message).join(", ") });
      if (e?.status === 400) return res.status(400).json({ message: e.message });
      next(e);
    }
  });
}

// server/menuLibrary.ts
import { and as and2, asc, eq as eq6, inArray } from "drizzle-orm";
import { z as z6 } from "zod";
var normalize = (value) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
var idSchema = z6.string().uuid();
var itemIdsSchema = z6.array(idSchema).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "Select each item once");
var media = new ObjectStorageService();
function mountMenuLibrary(app) {
  app.get("/api/menu-library", isAuthenticated, async (req, res, next) => {
    try {
      const items = await db.select().from(globalMenuItems).where(eq6(globalMenuItems.archived, false)).orderBy(asc(globalMenuItems.categoryTitle), asc(globalMenuItems.name));
      res.json(items.map(({ sourceImageUrl, ...item }) => ({ ...item, canManage: req.user.role === "super_admin" || item.publisherId === req.user.id })));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/menu-library/targets", isAuthenticated, async (req, res, next) => {
    try {
      const targets = await db.select({ id: restaurants.id, name: restaurants.name, currency: restaurants.currency, theme: restaurants.theme }).from(restaurants).where(req.user.role === "super_admin" ? void 0 : eq6(restaurants.userId, req.user.id)).orderBy(asc(restaurants.name));
      const cats = targets.length ? await db.select().from(categories).where(inArray(categories.restaurantId, targets.map((c) => c.id))).orderBy(asc(categories.order)) : [];
      res.json(targets.map((c) => ({ ...c, categories: cats.filter((cat) => cat.restaurantId === c.id) })));
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/menu-library/publish", isAuthenticated, async (req, res, next) => {
    const copies = [];
    try {
      const input = z6.object({ restaurantId: idSchema, itemIds: itemIdsSchema.optional() }).parse(req.body);
      const result = await db.transaction(async (tx) => {
        const [cafe] = await tx.select().from(restaurants).where(eq6(restaurants.id, input.restaurantId)).for("update");
        if (!cafe || req.user.role !== "super_admin" && cafe.userId !== req.user.id) return null;
        const source = await tx.select({ item: menuItems, category: categories }).from(menuItems).innerJoin(categories, eq6(menuItems.categoryId, categories.id)).where(and2(eq6(categories.restaurantId, cafe.id), input.itemIds ? inArray(menuItems.id, input.itemIds) : void 0)).orderBy(asc(categories.order), asc(menuItems.order));
        if (input.itemIds && source.length !== input.itemIds.length) throw new Error("Choose items from this caf\xE9");
        const variants = source.length ? await tx.select().from(menuItemPriceVariants).where(inArray(menuItemPriceVariants.menuItemId, source.map((s) => s.item.id))).orderBy(asc(menuItemPriceVariants.order)) : [];
        for (const { item, category } of source) {
          const [existing] = await tx.select().from(globalMenuItems).where(eq6(globalMenuItems.sourceItemId, item.id));
          let imageUrl = existing?.sourceImageUrl === item.imageUrl ? existing.imageUrl : null;
          if (item.imageUrl && !imageUrl) {
            imageUrl = await media.copyForOwner(item.imageUrl, cafe.userId);
            copies.push(imageUrl);
          }
          const values = {
            sourceItemId: item.id,
            publisherId: cafe.userId,
            sourceCafe: cafe.name,
            currency: cafe.currency,
            categoryTitle: category.title,
            name: item.name,
            description: item.description,
            price: item.price,
            unit: item.unit,
            tags: item.tags || [],
            sourceImageUrl: item.imageUrl,
            imageUrl,
            modifierGroups: item.modifierGroups || [],
            variants: item.hasMultiplePricing ? variants.filter((v) => v.menuItemId === item.id).map(({ label, price, unit }) => ({ label, price, unit })) : [],
            archived: false,
            updatedAt: /* @__PURE__ */ new Date()
          };
          await tx.insert(globalMenuItems).values(values).onConflictDoUpdate({ target: globalMenuItems.sourceItemId, set: values });
        }
        return { saved: source.length };
      });
      if (!result) return res.status(403).json({ message: "Choose a caf\xE9 you manage" });
      res.json(result);
    } catch (e) {
      await Promise.all(copies.map((url) => media.removeCopiedObject(url)));
      if (e instanceof Error && e.message === "Choose items from this caf\xE9") return res.status(400).json({ message: e.message });
      next(e);
    }
  });
  app.post("/api/menu-library/import", isAuthenticated, async (req, res, next) => {
    const copies = [];
    try {
      const input = z6.object({
        restaurantId: idSchema,
        itemIds: itemIdsSchema,
        categoryId: idSchema.optional(),
        isAvailable: z6.boolean().default(false),
        acceptCurrencyDifference: z6.boolean().default(false)
      }).parse(req.body);
      const result = await db.transaction(async (tx) => {
        const [cafe] = await tx.select().from(restaurants).where(eq6(restaurants.id, input.restaurantId)).for("update");
        if (!cafe || req.user.role !== "super_admin" && cafe.userId !== req.user.id) return { error: "Choose a caf\xE9 you manage", status: 403 };
        const templates = await tx.select().from(globalMenuItems).where(and2(inArray(globalMenuItems.id, input.itemIds), eq6(globalMenuItems.archived, false))).orderBy(asc(globalMenuItems.categoryTitle), asc(globalMenuItems.name));
        if (templates.length !== input.itemIds.length) return { error: "Some library items are no longer available. Refresh and try again.", status: 400 };
        if (!input.acceptCurrencyDifference && templates.some((i) => i.currency !== cafe.currency)) return { error: `Confirm copying prices into ${cafe.currency}. Currency conversion is not automatic.`, status: 400 };
        const cats = await tx.select().from(categories).where(eq6(categories.restaurantId, cafe.id));
        if (input.categoryId && !cats.some((c) => c.id === input.categoryId)) return { error: "Choose a category from the destination caf\xE9", status: 400 };
        const existing = cats.length ? await tx.select().from(menuItems).where(inArray(menuItems.categoryId, cats.map((c) => c.id))) : [];
        const names = new Set(existing.map((i) => `${i.categoryId}:${normalize(i.name)}`));
        const createdIds = [], createdCategoryIds = [];
        let skipped = 0, categoryOrder = Math.max(-1, ...cats.map((c) => c.order)) + 1;
        const nextOrder = new Map(cats.map((c) => [c.id, Math.max(-1, ...existing.filter((i) => i.categoryId === c.id).map((i) => i.order)) + 1]));
        for (const template of templates) {
          let category = input.categoryId ? cats.find((c) => c.id === input.categoryId) : cats.find((c) => normalize(c.title) === normalize(template.categoryTitle));
          if (!category) {
            [category] = await tx.insert(categories).values({ restaurantId: cafe.id, title: template.categoryTitle, order: categoryOrder++ }).returning();
            cats.push(category);
            createdCategoryIds.push(category.id);
          }
          const key = `${category.id}:${normalize(template.name)}`;
          if (names.has(key)) {
            skipped++;
            continue;
          }
          let imageUrl = null;
          if (template.imageUrl) {
            imageUrl = await media.copyForOwner(template.imageUrl, cafe.userId);
            copies.push(imageUrl);
          }
          const order = nextOrder.get(category.id) || 0;
          nextOrder.set(category.id, order + 1);
          const [item] = await tx.insert(menuItems).values({
            categoryId: category.id,
            name: template.name,
            description: template.description,
            price: template.price,
            unit: template.unit,
            imageUrl,
            tags: template.tags,
            modifierGroups: template.modifierGroups || [],
            hasMultiplePricing: template.variants.length > 0,
            discount: "0",
            specialDate: null,
            isAvailable: input.isAvailable,
            order
          }).returning();
          if (template.variants.length) await tx.insert(menuItemPriceVariants).values(template.variants.map((v, order2) => ({ ...v, menuItemId: item.id, discount: "0", order: order2 })));
          names.add(key);
          createdIds.push(item.id);
        }
        return { added: createdIds.length, skipped, createdIds, createdCategoryIds };
      });
      if ("error" in result) return res.status(result.status).json({ message: result.error });
      res.json(result);
    } catch (e) {
      await Promise.all(copies.map((url) => media.removeCopiedObject(url)));
      next(e);
    }
  });
  app.delete("/api/menu-library/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = idSchema.parse(req.params.id);
      const [item] = await db.update(globalMenuItems).set({ archived: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq6(globalMenuItems.id, id), req.user.role === "super_admin" ? void 0 : eq6(globalMenuItems.publisherId, req.user.id))).returning({ id: globalMenuItems.id });
      if (!item) return res.status(404).json({ message: "Library item not found or belongs to another manager" });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
}

// server/platformControls.ts
import { and as and3, eq as eq7, sql as sql4 } from "drizzle-orm";
import { z as z7 } from "zod";
var profileSchema = cafeProfileSchema.partial().extend({
  name: z7.string().trim().min(1).max(150).optional(),
  theme: z7.enum(["e3", "forest", "terracotta", "ocean", "plum"]).optional(),
  currency: z7.enum(["SAR", "QAR", "INR", "AED", "USD", "EUR", "GBP"]).optional(),
  timezone: z7.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }).optional(),
  status: z7.enum(["active", "suspended", "pending"]).optional(),
  hidden: z7.boolean().optional()
}).strict();
var media2 = new ObjectStorageService();
async function mediaForCafe(url, cafeOwner, actorId) {
  try {
    return await media2.trySetObjectEntityAclPolicy(url, { owner: cafeOwner, visibility: "public" });
  } catch {
    await media2.trySetObjectEntityAclPolicy(url, { owner: actorId, visibility: "public" });
    return media2.copyForOwner(url, cafeOwner);
  }
}
function mountPlatformControls(app) {
  const credentialLimit = rateLimit(30, 60 * 60 * 1e3, (req) => req.user.id);
  app.use((req, res, next) => {
    const provisioning = req.method === "POST" && /^\/api\/super-admin\/(users|restaurants)$/.test(req.path);
    const passwordChange = req.method === "PUT" && (/^\/api\/super-admin\/restaurants\/[^/]+\/password$/.test(req.path) || /^\/api\/super-admin\/users\/[^/]+$/.test(req.path) && req.body?.password !== void 0);
    return provisioning || passwordChange ? credentialLimit(req, res, next) : next();
  });
  app.post("/api/super-admin/users", isSuperAdmin, async (req, res, next) => {
    try {
      const input = z7.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z7.string().trim().min(1).max(100),
        lastName: z7.string().trim().min(1).max(100),
        role: z7.enum(["admin", "super_admin"]),
        restaurantName: z7.string().trim().min(1).max(150).optional()
      }).strict().refine(
        (v) => v.role === "super_admin" ? !v.restaurantName : !!v.restaurantName,
        "Caf\xE9 managers need a restaurant name; super admins do not."
      ).parse(req.body);
      const password = await default2.hash(input.password, 12);
      const result = await db.transaction(async (tx) => {
        const [created] = await tx.insert(users).values({ email: input.email, password, firstName: input.firstName, lastName: input.lastName, role: input.role }).returning();
        let cafe;
        if (input.role === "admin") [cafe] = await tx.insert(restaurants).values({ userId: created.id, name: input.restaurantName }).returning();
        const { password: hidden, ...user } = created;
        return { user, cafe };
      });
      req.platformCafe = result.cafe;
      res.status(201).json(result);
    } catch (e) {
      if (e.code === "23505" || e.cause?.code === "23505") return res.status(409).json({ message: "An account with this email already exists, including deleted accounts." });
      next(e);
    }
  });
  const changeAccountStatus = (accountStatus, restore = false) => async (req, res, next) => {
    try {
      if (!z7.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Choose a valid account" });
      const result = await db.transaction(async (tx) => {
        const platformAdmins = await tx.select().from(users).where(eq7(users.role, "super_admin")).orderBy(users.id).for("update");
        const [target] = await tx.select().from(users).where(eq7(users.id, req.params.id)).for("update");
        if (!target) return { error: "Account not found", status: 404 };
        if (accountStatus !== "active" && target.id === req.user.id) return { error: "You cannot freeze or delete your own account", status: 400 };
        if (accountStatus !== "active" && target.role === "super_admin" && target.accountStatus === "active" && platformAdmins.filter((u) => u.accountStatus === "active").length <= 1)
          return { error: "Keep at least one active super admin account", status: 400 };
        if (target.accountStatus === "deleted" && accountStatus !== "deleted" && !restore) return { error: "Restore this deleted account first", status: 409 };
        if (restore && target.accountStatus !== "deleted") return { error: "Only deleted accounts can be restored", status: 409 };
        const [updated] = await tx.update(users).set({ accountStatus, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(users.id, target.id)).returning();
        await tx.delete(sessions).where(sql4`${sessions.sess}->>'userId' = ${target.id}`);
        const { password: hidden, ...user } = updated;
        return { user };
      });
      if ("error" in result) return res.status(result.status).json({ message: result.error });
      req.platformCafe = await storage.getRestaurantByUserId(req.params.id);
      res.json(result.user);
    } catch (e) {
      next(e);
    }
  };
  app.post("/api/super-admin/users/:id/freeze", isSuperAdmin, changeAccountStatus("frozen"));
  app.post("/api/super-admin/users/:id/unfreeze", isSuperAdmin, changeAccountStatus("active"));
  app.delete("/api/super-admin/users/:id", isSuperAdmin, changeAccountStatus("deleted"));
  app.post("/api/super-admin/users/:id/restore", isSuperAdmin, changeAccountStatus("active", true));
  app.use(async (req, res, next) => {
    const match = req.path.match(/^\/api\/super-admin\/restaurants\/([^/]+)(?:\/|$)/);
    try {
      let cafeId = match?.[1];
      if (!cafeId && ["PUT", "DELETE"].includes(req.method)) {
        const categoryMatch = req.path.match(/^\/api\/super-admin\/categories\/([^/]+)$/);
        const itemMatch = req.path.match(/^\/api\/super-admin\/menu-items\/([^/]+)$/);
        if (categoryMatch) {
          const [cat] = await db.select().from(categories).where(eq7(categories.id, categoryMatch[1]));
          cafeId = cat?.restaurantId;
        }
        if (itemMatch) {
          const [row] = await db.select({ cafeId: categories.restaurantId }).from(menuItems).innerJoin(categories, eq7(menuItems.categoryId, categories.id)).where(eq7(menuItems.id, itemMatch[1]));
          cafeId = row?.cafeId;
        }
        if ((categoryMatch || itemMatch) && !cafeId) return res.status(404).json({ message: "Item not found" });
      }
      if (!cafeId) return next();
      const cafe = await storage.getRestaurantById(cafeId);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      req.platformCafe = cafe;
      next();
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/super-admin/restaurants/:id/upload", isSuperAdmin, rateLimit(100, 60 * 60 * 1e3, (req) => req.user.id), async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      res.json({ uploadURL: signedUploadURL(cafe.userId, req.user) });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/users/:id", isSuperAdmin, async (req, res, next) => {
    try {
      const data = z7.object({
        email: emailSchema.optional(),
        firstName: z7.string().trim().max(100).nullable().optional(),
        lastName: z7.string().trim().max(100).nullable().optional(),
        role: z7.enum(["admin", "super_admin"]).optional(),
        password: passwordSchema.optional()
      }).strict().refine((v) => Object.keys(v).length > 0, "Choose an account field to update").parse(req.body);
      const password = data.password ? await default2.hash(data.password, 12) : void 0;
      const result = await db.transaction(async (tx) => {
        const superAdmins = await tx.select().from(users).where(eq7(users.role, "super_admin")).orderBy(users.id).for("update");
        const [target] = await tx.select().from(users).where(eq7(users.id, req.params.id)).for("update");
        if (!target) return { error: "Account not found", status: 404 };
        if (target.accountStatus === "deleted") return { error: "Restore this deleted account before editing it", status: 409 };
        if (data.email && (await tx.select().from(users).where(and3(sql4`lower(${users.email}) = ${data.email}`, sql4`${users.id} <> ${target.id}`))).length) return { error: "An account with this email already exists", status: 409 };
        if (target.role === "super_admin" && target.accountStatus === "active" && data.role === "admin" && superAdmins.filter((u) => u.accountStatus === "active").length <= 1) return { error: "Keep at least one active super admin account", status: 400 };
        const [updated] = await tx.update(users).set({ ...data, ...password ? { password } : {}, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(users.id, target.id)).returning();
        if (password || data.role && data.role !== target.role) await tx.delete(sessions).where(sql4`${sessions.sess}->>'userId' = ${target.id}`);
        const { password: hidden, ...safe } = updated;
        return { user: safe };
      });
      if ("error" in result) return res.status(result.status).json({ message: result.error });
      res.json(result.user);
    } catch (e) {
      if (e.code === "23505" || e.cause?.code === "23505") return res.status(409).json({ message: "An account with this email already exists" });
      next(e);
    }
  });
  app.put("/api/super-admin/restaurants/:id", isSuperAdmin, async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      const data = profileSchema.parse(req.body);
      for (const key of ["logoUrl", "coverMediaUrl"]) if (data[key]) {
        const kind = await media2.mediaType(data[key], key !== "coverMediaUrl");
        data[key] = await mediaForCafe(data[key], cafe.userId, req.user.id);
        if (key === "coverMediaUrl") data.coverMediaType = kind;
      }
      if ("coverMediaUrl" in data && !data.coverMediaUrl) data.coverMediaType = null;
      res.json(await storage.updateRestaurant(cafe.id, data));
    } catch (e) {
      next(e);
    }
  });
  app.delete("/api/super-admin/restaurants/:id", isSuperAdmin, async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      await db.transaction(async (tx) => {
        await tx.delete(restaurants).where(eq7(restaurants.id, cafe.id));
        const [owner] = await tx.select().from(users).where(eq7(users.id, cafe.userId));
        if (owner?.role === "admin") await tx.delete(sessions).where(sql4`${sessions.sess}->>'userId' = ${cafe.userId}`);
        await tx.delete(users).where(and3(eq7(users.id, cafe.userId), eq7(users.role, "admin")));
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/restaurants/:id/password", isSuperAdmin, async (req, res, next) => {
    try {
      const { newPassword } = z7.object({ newPassword: passwordSchema }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      const password = await default2.hash(newPassword, 12);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ password, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(users.id, cafe.userId));
        await tx.delete(sessions).where(sql4`${sessions.sess}->>'userId' = ${cafe.userId}`);
      });
      res.json({ success: true, message: "Manager password reset. Previous sessions signed out." });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/restaurants/:id/cover-media", isSuperAdmin, async (req, res, next) => {
    try {
      const data = z7.object({ coverMediaUrl: z7.string(), coverMediaType: z7.enum(["image", "video", "gif"]).nullable() }).strict().parse(req.body);
      const cafe = await storage.getRestaurantById(req.params.id);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      const url = data.coverMediaUrl ? await mediaForCafe(data.coverMediaUrl.split("?")[0], cafe.userId, req.user.id) : null;
      const kind = url ? await media2.mediaType(url) : null;
      await storage.updateRestaurant(cafe.id, { coverMediaUrl: url, coverMediaType: kind });
      res.json({ objectPath: url, coverMediaType: kind });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/restaurants/:id/profile", isSuperAdmin, async (req, res, next) => {
    try {
      const data = cafeProfileSchema.pick({ name: true, cuisineType: true, address: true, phone: true, openingHours: true }).partial().parse(req.body);
      if (!Object.keys(data).length) return res.status(400).json({ message: "Choose a profile field to update" });
      res.json(await storage.updateRestaurant(req.platformCafe.id, data));
    } catch (e) {
      next(e);
    }
  });
  app.all(["/api/super-admin/payments", "/api/super-admin/payments/:restaurantId"], isSuperAdmin, (_req, res) => {
    res.status(410).json({ message: "Payments are disabled for internal restaurant management." });
  });
  app.post("/api/super-admin/restaurants/:restaurantId/categories", isSuperAdmin, async (req, res, next) => {
    try {
      if (!await storage.getRestaurantById(req.params.restaurantId)) return res.status(404).json({ message: "Caf\xE9 not found" });
      const data = insertCategorySchema.parse({ ...req.body, restaurantId: req.params.restaurantId });
      const cats = await storage.getCategoriesByRestaurantId(data.restaurantId);
      if (cats.some((c) => c.title.toLowerCase() === data.title.toLowerCase())) return res.status(400).json({ message: "Category already exists" });
      res.json(await storage.createCategory(data));
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/categories/:id", isSuperAdmin, async (req, res, next) => {
    try {
      const [category] = await db.select().from(categories).where(eq7(categories.id, req.params.id));
      if (!category) return res.status(404).json({ message: "Category not found" });
      const data = insertCategorySchema.pick({ title: true, order: true }).partial().strict().parse(req.body);
      const cats = await storage.getCategoriesByRestaurantId(category.restaurantId);
      if (data.title && cats.some((c) => c.id !== category.id && c.title.toLowerCase() === data.title.toLowerCase())) return res.status(400).json({ message: "Category already exists" });
      res.json(await storage.updateCategory(category.id, data));
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/super-admin/restaurants/:restaurantId/menu-items", isSuperAdmin, async (req, res, next) => {
    try {
      const cafe = await storage.getRestaurantById(req.params.restaurantId);
      if (!cafe) return res.status(404).json({ message: "Caf\xE9 not found" });
      const data = insertMenuItemSchema.parse(req.body);
      if (!(await storage.getCategoriesByRestaurantId(cafe.id)).some((c) => c.id === data.categoryId)) return res.status(400).json({ message: "Choose a category from this caf\xE9" });
      if (data.imageUrl) {
        await media2.mediaType(data.imageUrl, true);
        data.imageUrl = await mediaForCafe(data.imageUrl, cafe.userId, req.user.id);
      }
      if (data.hasMultiplePricing) return res.status(400).json({ message: "Use the caf\xE9 workspace to save price options together" });
      res.json(await storage.createMenuItem({ ...data, price: String(data.price), discount: String(data.discount || 0) }));
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/super-admin/menu-items/:id", isSuperAdmin, async (req, res, next) => {
    try {
      const [item] = await db.select().from(menuItems).where(eq7(menuItems.id, req.params.id));
      if (!item) return res.status(404).json({ message: "Menu item not found" });
      const [category] = await db.select().from(categories).where(eq7(categories.id, item.categoryId));
      const cafe = await storage.getRestaurantById(category.restaurantId);
      const data = insertMenuItemSchema.partial().parse(req.body);
      if (data.categoryId && !(await storage.getCategoriesByRestaurantId(category.restaurantId)).some((c) => c.id === data.categoryId)) return res.status(400).json({ message: "Use the library to copy items to another caf\xE9" });
      if (data.hasMultiplePricing !== void 0 && data.hasMultiplePricing !== item.hasMultiplePricing) return res.status(400).json({ message: "Use the caf\xE9 workspace to change price options" });
      if (data.imageUrl) {
        await media2.mediaType(data.imageUrl, true);
        data.imageUrl = await mediaForCafe(data.imageUrl, cafe.userId, req.user.id);
      }
      res.json(await storage.updateMenuItem(item.id, { ...data, ...data.price === void 0 ? {} : { price: String(data.price) }, ...data.discount === void 0 ? {} : { discount: String(data.discount) } }));
    } catch (e) {
      next(e);
    }
  });
}

// server/routes.ts
import { fromZodError as fromZodError2 } from "zod-validation-error";
import { z as z8 } from "zod";
async function registerRoutes(app) {
  await setupAuth(app);
  app.post("/api/register-restaurant", (_req, res) => res.status(410).json({ message: "Restaurant accounts are created by the super admin." }));
  mountAccessControl(app);
  mountLocalUploads(app);
  mountCafeControls(app);
  mountMenuLibrary(app);
  mountPlatformControls(app);
  app.post("/api/super-admin/restaurants", isSuperAdmin, rateLimit(10, 60 * 60 * 1e3, (req) => req.ip || "unknown"), async (req, res) => {
    try {
      const validationResult = registrationSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError2(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      const { email, password, firstName, lastName, restaurantName } = validationResult.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }
      const hashedPassword = await default2.hash(password, 12);
      const created = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({ email, password: hashedPassword, firstName, lastName, role: "admin" }).returning();
        const [cafe] = await tx.insert(restaurants).values({ userId: user.id, name: restaurantName }).returning();
        return { user, cafe };
      });
      req.platformCafe = created.cafe;
      res.status(201).json({ message: "Restaurant and manager created.", id: created.cafe.id, email: created.user.email });
    } catch (error) {
      if (error.code === "23505" || error.cause?.code === "23505") return res.status(409).json({ message: "Email already registered" });
      console.error("Error registering restaurant:", { type: error.name, code: error.code || error.cause?.code });
      res.status(500).json({ message: "Failed to register restaurant" });
    }
  });
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      res.json(await authUser(req));
    } catch (error) {
      console.error("Error fetching user:", safeError(error));
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app.get("/api/super-admin/restaurants", isSuperAdmin, async (_req, res) => {
    try {
      const restaurants2 = await storage.getAllRestaurants();
      const users2 = await storage.getAllUsers();
      const restaurantsWithUsers = restaurants2.map((restaurant) => {
        const user = users2.find((u) => u.id === restaurant.userId);
        return {
          ...restaurant,
          owner: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          } : null
        };
      });
      res.json(restaurantsWithUsers);
    } catch (error) {
      console.error("Error fetching all restaurants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });
  app.get("/api/super-admin/users", isSuperAdmin, async (_req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const sanitizedUsers = users2.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", safeError(error));
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app.get("/api/super-admin/restaurants/:restaurantId/categories", isSuperAdmin, async (req, res) => {
    try {
      const categories2 = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app.delete("/api/super-admin/categories/:id", isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", safeError(error));
      res.status(500).json({ message: "Failed to delete category" });
    }
  });
  app.get("/api/super-admin/restaurants/:restaurantId/menu-items", isSuperAdmin, async (req, res) => {
    try {
      const items = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(req.path.includes("/public/") ? items.filter((item) => item.isAvailable) : items);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });
  app.delete("/api/super-admin/menu-items/:id", isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteMenuItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting menu item:", safeError(error));
      res.status(500).json({ message: "Failed to delete menu item" });
    }
  });
  app.put("/api/super-admin/restaurants/:id/suspend", isSuperAdmin, async (req, res) => {
    try {
      const suspendSchema = z8.object({
        reason: z8.string().min(5, "Suspension reason must be at least 5 characters")
      });
      const validatedData = suspendSchema.parse(req.body);
      const restaurant = await storage.updateRestaurant(req.params.id, {
        status: "suspended",
        suspensionReason: validatedData.reason
      });
      res.json(restaurant);
    } catch (error) {
      console.error("Error suspending restaurant:", safeError(error));
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid suspension data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to suspend restaurant" });
    }
  });
  app.put("/api/super-admin/restaurants/:id/activate", isSuperAdmin, async (req, res) => {
    try {
      const restaurant = await storage.updateRestaurant(req.params.id, {
        status: "active",
        suspensionReason: null
      });
      res.json(restaurant);
    } catch (error) {
      console.error("Error activating restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to activate restaurant" });
    }
  });
  app.all("/api/super-admin/restaurants/:id/subscription", isSuperAdmin, (_req, res) => {
    res.status(410).json({ message: "Subscriptions are disabled for internal restaurant management." });
  });
  app.get("/api/super-admin/restaurants/:id", isSuperAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const owner = await storage.getUserById(restaurant.userId);
      const restaurantWithOwner = { ...restaurant, owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null };
      res.json(restaurantWithOwner);
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });
  app.put("/api/super-admin/restaurants/:id/visibility", isSuperAdmin, async (req, res) => {
    try {
      const visibilitySchema = z8.object({
        hidden: z8.boolean()
      });
      const validatedData = visibilitySchema.parse(req.body);
      const restaurant = await storage.updateRestaurant(req.params.id, validatedData);
      res.json(restaurant);
    } catch (error) {
      console.error("Error updating visibility:", safeError(error));
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid visibility data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update visibility" });
    }
  });
  app.get("/api/super-admin/categories/:restaurantId", isSuperAdmin, async (req, res) => {
    try {
      const categories2 = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app.get("/api/super-admin/menu-items/:restaurantId", isSuperAdmin, async (req, res) => {
    try {
      const menuItems2 = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(menuItems2);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });
  app.get("/api/restaurant", isAuthenticated, async (req, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });
  app.get("/api/restaurant/public/:id", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours } = restaurant;
      res.json({ id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours });
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });
  app.put("/api/restaurant/logo", isAuthenticated, async (req, res) => {
    try {
      const userId = await mediaOwner(req);
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.mediaType(req.body.logoUrl, true);
      const objectPath2 = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.logoUrl,
        {
          owner: userId,
          visibility: "public"
        }
      );
      res.status(200).json({ objectPath: objectPath2 });
    } catch (error) {
      console.error("Error setting logo:", safeError(error));
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app.all("/api/restaurant/upi-qr", isAuthenticated, (_req, res) => {
    res.status(410).json({ message: "Payment QR codes are disabled. Use the permanent menu QR." });
  });
  app.put("/api/restaurant/cover-media", isAuthenticated, async (req, res) => {
    try {
      const coverMediaSchema = z8.object({
        coverMediaUrl: z8.string(),
        coverMediaType: z8.enum(["image", "video", "gif"]).nullable()
      });
      const validatedData = coverMediaSchema.parse(req.body);
      const userId = await mediaOwner(req);
      const userRestaurant = await getManagedCafe(req);
      if (!userRestaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      let objectPath2 = null;
      let coverMediaType = validatedData.coverMediaType;
      if (validatedData.coverMediaUrl && validatedData.coverMediaUrl !== "") {
        const objectStorageService = new ObjectStorageService();
        objectPath2 = await objectStorageService.trySetObjectEntityAclPolicy(
          validatedData.coverMediaUrl,
          {
            owner: userId,
            visibility: "public"
          }
        );
        coverMediaType = await objectStorageService.mediaType(objectPath2);
      } else {
        objectPath2 = null;
        coverMediaType = null;
      }
      await storage.updateRestaurant(userRestaurant.id, {
        coverMediaUrl: objectPath2,
        coverMediaType
      });
      res.status(200).json({ objectPath: objectPath2, coverMediaType });
    } catch (error) {
      console.error("Error setting cover media:", safeError(error));
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ error: "Invalid cover media data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const categories2 = await storage.getCategoriesByRestaurantId(restaurant.id);
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app.get("/api/categories/public/:restaurantId", async (req, res) => {
    try {
      const categories2 = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const validationResult = insertCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError2(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      const category = await storage.createCategory(validationResult.data);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", safeError(error));
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", safeError(error));
      res.status(500).json({ message: "Failed to delete category" });
    }
  });
  app.get("/api/menu-items", isAuthenticated, async (req, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const items = await storage.getMenuItemsByRestaurantId(restaurant.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });
  app.get("/api/menu-items/public/:restaurantId", async (req, res) => {
    try {
      const items = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(items.filter((item) => item.isAvailable));
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });
  app.put("/api/menu-items/image", isAuthenticated, async (req, res) => {
    const schema = z8.object({
      imageUrl: z8.string(),
      menuItemId: z8.string().optional()
    });
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      const validationError = fromZodError2(validationResult.error);
      console.error("[menu-items/image] Validation failed:", validationError.message);
      return res.status(400).json({ message: validationError.message });
    }
    const { imageUrl, menuItemId } = validationResult.data;
    const userId = await mediaOwner(req);
    const objectStorageService = new ObjectStorageService();
    try {
      const objectPath2 = await objectStorageService.trySetObjectEntityAclPolicy(
        imageUrl,
        {
          owner: userId,
          visibility: "public"
        }
      );
      if (menuItemId) {
        await storage.updateMenuItem(menuItemId, { imageUrl: objectPath2 });
      }
      const responseData = { objectPath: objectPath2 || imageUrl };
      res.status(200);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(responseData));
      return;
    } catch (error) {
      console.error("[menu-items/image] Error:", safeError(error));
      return res.status(400).json({ message: "Choose a valid photo uploaded for this caf\xE9" });
    }
  });
  app.delete("/api/menu-items/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMenuItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting menu item:", safeError(error));
      res.status(500).json({ message: "Failed to delete menu item" });
    }
  });
  app.get("/api/price-variants/:menuItemId", isAuthenticated, async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByMenuItemId(req.params.menuItemId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });
  app.get("/api/price-variants/public/:menuItemId", async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByMenuItemId(req.params.menuItemId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });
  app.get("/api/price-variants/public/restaurant/:restaurantId", async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByRestaurantId(req.params.restaurantId);
      const visible = new Set((await storage.getMenuItemsByRestaurantId(req.params.restaurantId)).filter((i) => i.isAvailable).map((i) => i.id));
      res.json(variants.filter((v) => visible.has(v.menuItemId)));
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", safeError(error));
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", safeError(error));
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint not found" }));
  const httpServer = createServer(app);
  return httpServer;
}

// server/apiApplication.ts
async function createApiApplication() {
  const app = express2();
  mountHttpSecurity(app);
  const json = express2.json({ limit: "1mb" });
  app.use((req, res, next) => req.path.startsWith("/objects/") ? next() : json(req, res, next));
  app.use(express2.urlencoded({ extended: false, limit: "100kb" }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method) && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body))) return res.status(400).json({ message: "Send a JSON object" });
    next();
  });
  const server = await registerRoutes(app);
  return { app, server };
}
function mountErrorHandler(app) {
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    const databaseCode = err.code || err.cause?.code;
    const constraintStatus = databaseCode === "23505" || databaseCode === "23503" ? 409 : databaseCode === "23514" ? 400 : void 0;
    const rawStatus = constraintStatus || (err.name === "ZodError" ? 400 : err.status || err.statusCode || 500);
    const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
    const message = constraintStatus ? "This record conflicts with the latest saved data. Refresh and try again." : status >= 500 ? "Unable to complete this request" : err.name === "ZodError" ? err.issues.map((i) => i.message).join(", ") : status === 413 ? "This request is too large" : err.type === "entity.parse.failed" ? "Invalid JSON request" : err.message || "Request failed";
    if (status >= 500) console.error("Request failed", { type: err.name, code: databaseCode });
    res.status(status).json({ message });
  });
}

// server/vercelApp.ts
var appPromise = null;
function getVercelApp() {
  if (!appPromise) {
    appPromise = (async () => {
      if (process.env.TRUST_PROXY === void 0) process.env.TRUST_PROXY = "true";
      if (process.env.COOKIE_SECURE === void 0) process.env.COOKIE_SECURE = "true";
      const probe = databaseEnvProbe();
      if (!usingRemoteDatabase) {
        throw new Error(
          `Postgres URL required on Vercel (DATABASE_URL or POSTGRES_URL_NON_POOLING / POSTGRES_URL). Probe: databaseUrl=${probe.hasDatabaseUrl} postgresNonPooling=${probe.hasPostgresNonPooling} postgresUrl=${probe.hasPostgresUrl}`
        );
      }
      if (!probe.sessionSecretOk) {
        throw new Error("SESSION_SECRET must be set on Vercel and at least 48 characters");
      }
      if (!usingSupabaseMedia) {
        console.warn("Supabase Storage env incomplete; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for media");
      }
      await initializeDatabase();
      const { app } = await createApiApplication();
      mountErrorHandler(app);
      return app;
    })().catch((error) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

// server/vercelEntry.ts
async function handler(req, res) {
  const url = req.url || "/";
  const pathOnly = url.split("?")[0];
  if (pathOnly === "/api/healthz" || pathOnly === "/healthz") {
    const probe = databaseEnvProbe();
    res.statusCode = probe.usingRemoteDatabase && probe.sessionSecretOk ? 200 : 503;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: res.statusCode === 200, ...probe }));
    return;
  }
  try {
    const app = await getVercelApp();
    return app(req, res);
  } catch (error) {
    console.error("Vercel API boot failed", error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({
        message: "API failed to start",
        detail: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}
export {
  handler as default
};
