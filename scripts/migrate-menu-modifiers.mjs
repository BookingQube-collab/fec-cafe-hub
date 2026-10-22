import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
config({ path: '.env.cloud', quiet: true });
assert.ok(/^[a-z]{20}$/.test(process.env.SUPABASE_PROJECT_REF || ''), 'SUPABASE_PROJECT_REF must be the 20-letter project ref');
assert.equal(process.env.SUPABASE_URL, `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const tables = ['menu_items', 'global_menu_items', 'menu_item_price_variants', 'categories', 'restaurants'];
async function snapshot() {
  return Object.fromEntries(await Promise.all(tables.map(async table => [table, (await pool.query(`SELECT to_jsonb(t)-'modifier_groups' AS record FROM ${table} t ORDER BY id`)).rows])));
}
try {
  const before = await snapshot();
  const accountsBefore = (await pool.query('SELECT id,email,role,account_status FROM users ORDER BY id')).rows;
  const protectionBefore = (await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('menu_items','global_menu_items') ORDER BY relname")).rows;
  await migrate(drizzle(pool), { migrationsFolder: 'migrations' });
  assert.deepEqual(await snapshot(), before, 'Existing café/menu/library data must be preserved');
  assert.deepEqual((await pool.query('SELECT id,email,role,account_status FROM users ORDER BY id')).rows, accountsBefore);
  assert.deepEqual((await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('menu_items','global_menu_items') ORDER BY relname")).rows, protectionBefore);
  for (const table of ['menu_items', 'global_menu_items']) {
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE modifier_groups IS NULL OR jsonb_typeof(modifier_groups)<>'array'`)).rows[0].n, 0);
  }
  const result = { passed: true, migration: '0006_lame_bedlam', existingDataPreserved: true, accountsPreserved: true, rlsPreserved: true,
    counts: Object.fromEntries(tables.map(table => [table, before[table].length])), checkedAt: new Date().toISOString() };
  await fs.writeFile('data/menu-modifiers-migration.json', JSON.stringify(result, null, 2));
  console.log('PASS: additive modifier columns applied; existing café menus, library, accounts and row-level security preserved.');
} catch (error) {
  console.error('Modifier migration failed', { type: error.name, code: error.code || 'VERIFICATION_FAILED' });
  process.exitCode = 1;
} finally { await pool.end(); }
