/**
 * Upsert menu_designs.enabled for a café.
 * Usage: npx tsx scripts/enable-arena.ts <restaurantId> [on|off]
 *
 * Default: local PGlite only (clears DATABASE_URL so server/db does not pick up .env.cloud).
 * Cloud: set ALLOW_CLOUD_ARENA=1 after explicit approval.
 */
import { config } from 'dotenv';
config();

const restaurantId = process.argv[2];
const mode = (process.argv[3] || 'on').toLowerCase();
if (!restaurantId || !/^[0-9a-f-]{36}$/i.test(restaurantId) || !['on', 'off'].includes(mode)) {
  console.error('Usage: npx tsx scripts/enable-arena.ts <restaurantId> [on|off]');
  process.exit(1);
}

const allowCloud = process.env.ALLOW_CLOUD_ARENA === '1';
if (allowCloud) {
  config({ path: '.env.cloud', quiet: true });
  console.log('ALLOW_CLOUD_ARENA=1 — writing to remote Postgres from .env.cloud');
} else {
  // Pin empty so dotenv inside server/db does not fill DATABASE_URL from .env.cloud.
  process.env.DATABASE_URL = '';
  process.env.POSTGRES_URL = '';
  process.env.POSTGRES_URL_NON_POOLING = '';
  console.log('Using local PGlite (data/database). Cloud write blocked unless ALLOW_CLOUD_ARENA=1.');
}

const { initializeDatabase, pool, db, usingRemoteDatabase } = await import('../server/db');
if (usingRemoteDatabase && !allowCloud) {
  console.error('Refusing remote write without ALLOW_CLOUD_ARENA=1');
  process.exit(2);
}
const { menuDesigns } = await import('../shared/schema');
await initializeDatabase();

const enabled = mode === 'on';
await db.insert(menuDesigns).values({
  restaurantId,
  enabled,
  settings: {},
  updatedAt: new Date(),
  updatedBy: null,
}).onConflictDoUpdate({
  target: menuDesigns.restaurantId,
  set: { enabled, updatedAt: new Date() },
});

console.log(`menu_designs: restaurant ${restaurantId} enabled=${enabled} (remote=${usingRemoteDatabase})`);
await pool.close();
