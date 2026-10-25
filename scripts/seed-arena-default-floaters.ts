/**
 * One-time upsert: copy decorative floater URLs from arena-default-design.json into
 * menu_designs.settings.groups.*.floaters so public matches the admin editor view.
 *
 * Usage:
 *   npx tsx scripts/seed-arena-default-floaters.ts <restaurantId>
 *   npx tsx scripts/seed-arena-default-floaters.ts --all
 *
 * Default: local PGlite. Cloud: ALLOW_CLOUD_ARENA=1 with .env.cloud.
 */
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import defaultsJson from '../client/src/menu-arena/arena-default-design.json';

config();

const target = process.argv[2];
const all = target === '--all';
if (!target || (!all && !/^[0-9a-f-]{36}$/i.test(target))) {
  console.error('Usage: npx tsx scripts/seed-arena-default-floaters.ts <restaurantId|--all>');
  process.exit(1);
}

const allowCloud = process.env.ALLOW_CLOUD_ARENA === '1';
if (allowCloud) {
  config({ path: '.env.cloud', quiet: true });
  console.log('ALLOW_CLOUD_ARENA=1 — writing to remote Postgres from .env.cloud');
} else {
  process.env.DATABASE_URL = '';
  process.env.POSTGRES_URL = '';
  process.env.POSTGRES_URL_NON_POOLING = '';
  console.log('Using local PGlite (data/database). Cloud write blocked unless ALLOW_CLOUD_ARENA=1.');
}

const dbMod = await import('../server/db');
if (dbMod.usingRemoteDatabase && !allowCloud) {
  console.error('Refusing remote write without ALLOW_CLOUD_ARENA=1');
  process.exit(2);
}
const { menuDesigns, restaurants, categories } = await import('../shared/schema');
await dbMod.initializeDatabase();

const defaultFloatersByKey = new Map(
  (defaultsJson.groups || []).map((g) => [g.key, (g.floaters || []).slice(0, 9)]),
);

const restaurantIds = all
  ? (await dbMod.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(sql`exists (select 1 from ${categories} where ${categories.restaurantId} = ${restaurants.id})`))
      .map((r) => r.id)
  : [target];

if (!restaurantIds.length) {
  console.error(all ? 'No restaurants with menus found' : 'No restaurants found');
  process.exit(3);
}

let updated = 0;
for (const restaurantId of restaurantIds) {
  const row = (await dbMod.db.select().from(menuDesigns).where(sql`${menuDesigns.restaurantId} = ${restaurantId}`).limit(1))[0];
  const prev =
    row?.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  const prevGroups = Array.isArray(prev.groups) ? (prev.groups as any[]) : [];
  const byKey = new Map(prevGroups.map((g) => [g.key, g]));

  const groups = ['food', 'drinks'].map((key) => {
    const existing = byKey.get(key) || { key };
    const floaters = defaultFloatersByKey.get(key) || Array(9).fill(null);
    return { ...existing, key, floaters };
  });

  const nextSettings = { ...prev, groups };

  await dbMod.db
    .insert(menuDesigns)
    .values({
      restaurantId,
      enabled: row?.enabled ?? true,
      settings: nextSettings,
      updatedAt: new Date(),
      updatedBy: null,
    })
    .onConflictDoUpdate({
      target: menuDesigns.restaurantId,
      set: {
        settings: nextSettings,
        updatedAt: new Date(),
      },
    });
  updated++;
  console.log(`seeded floaters for ${restaurantId}`);
}

console.log(`Done: ${updated} café(s). remote=${dbMod.usingRemoteDatabase}`);
await dbMod.pool.close();
