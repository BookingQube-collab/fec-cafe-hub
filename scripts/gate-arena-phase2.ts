/**
 * Phase 2 gate against the running server (cloud Supabase via .env.cloud).
 * Temporarily rotates café manager passwords for the gate, then restores hashes.
 *
 * Usage: npx tsx scripts/gate-arena-phase2.ts [baseUrl]
 */
import assert from 'node:assert/strict';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

config();
config({ path: '.env.cloud', quiet: true });

const base = (process.argv[2] || 'http://127.0.0.1:5100').replace(/\/$/, '');
const urbanId = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = '',
  expected?: number,
  cafeContext?: string,
) {
  const r = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...(cafeContext ? { 'X-Cafe-Context': cafeContext } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  if (expected !== undefined) assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  const set = r.headers.get('set-cookie')?.split(';')[0] || '';
  return { status: r.status, data, cookie: set || cookie };
}

async function tryLogin(email: string, password: string) {
  const r = await request('/api/login', 'POST', { email, password });
  return r.status === 200 && r.cookie ? r.cookie : null;
}

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!dbUrl) throw new Error('No DATABASE_URL in .env / .env.cloud');
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: /supabase\.co|sslmode=require/i.test(dbUrl) ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

type Cred = { id: string; email: string; hash: string; cafeId: string; cafeName: string };
const restores: Cred[] = [];

async function withTempPassword(email: string): Promise<{ cookie: string; cafeId: string; cafeName: string }> {
  const { rows } = await pool.query(
    `select u.id, u.email, u.password, r.id as cafe_id, r.name as cafe_name
     from users u join restaurants r on r.user_id = u.id
     where u.email = $1 limit 1`,
    [email],
  );
  assert.ok(rows[0], `user ${email}`);
  const row = rows[0];
  restores.push({ id: row.id, email: row.email, hash: row.password, cafeId: row.cafe_id, cafeName: row.cafe_name });
  const password = `Phase2Gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(`update users set password = $1, updated_at = now() where id = $2`, [hash, row.id]);
  const cookie = await tryLogin(email, password);
  assert.ok(cookie, `login ${email}`);
  return { cookie, cafeId: row.cafe_id, cafeName: row.cafe_name };
}

try {
  const urban = await withTempPassword('manager+urban-cafe@restore.local');
  assert.equal(urban.cafeId, urbanId);

  const before = await request('/api/admin/menu-design', 'GET', undefined, urban.cookie, 200, urbanId);
  assert.equal(before.data.restaurantId, urbanId);
  const originalEnabled = !!before.data.enabled;
  const originalSettings = before.data.settings || {};

  const menu = await request('/api/manager-menu', 'GET', undefined, urban.cookie, 200, urbanId);
  const pizza = (menu.data.categories || []).find((c: any) => /pizza/i.test(c.title));
  assert.ok(pizza, 'Urban pizza category');

  const probeSettings = {
    hero: { titleLine1: 'PHASE2', titleLine2: 'GATE' },
    bubbles: { enabled: false },
    categories: {
      [pizza.id]: { hue: '#112233', bannerUrl: '/assets/arena/banners/pizza.webp' },
    },
    groups: [
      {
        key: 'food',
        floaters: [
          '/assets/arena/floaters/food-9.webp',
          '/assets/arena/floaters/food-2.webp',
          '/assets/arena/floaters/food-3.webp',
          '/assets/arena/floaters/food-4.webp',
          '/assets/arena/floaters/food-5.webp',
          '/assets/arena/floaters/food-6.webp',
          '/assets/arena/floaters/food-7.webp',
          '/assets/arena/floaters/food-8.webp',
          '/assets/arena/floaters/food-1.webp',
        ],
      },
      { key: 'drinks' },
    ],
  };

  const saved = await request('/api/admin/menu-design', 'PUT', { enabled: true, settings: probeSettings }, urban.cookie, 200, urbanId);
  assert.equal(saved.data.enabled, true);
  assert.equal(saved.data.settings.hero.titleLine1, 'PHASE2');
  assert.equal(saved.data.settings.bubbles.enabled, false);

  const pub = await request(`/api/menu/public/${urbanId}`, 'GET', undefined, '', 200);
  assert.equal(pub.data.design?.enabled, true);
  assert.equal(pub.data.design?.settings?.hero?.titleLine1, 'PHASE2');
  assert.equal(pub.data.design?.settings?.bubbles?.enabled, false);
  assert.equal(pub.data.design?.settings?.categories?.[pizza.id]?.hue, '#112233');
  assert.equal(pub.data.design?.settings?.groups?.[0]?.floaters?.[0], '/assets/arena/floaters/food-9.webp');
  console.log('PASS: hero / category / floater / bubbles overrides visible on public Urban menu');

  await request('/api/admin/menu-design', 'PUT', { enabled: false }, urban.cookie, 200, urbanId);
  const off = await request(`/api/menu/public/${urbanId}`, 'GET', undefined, '', 200);
  assert.equal(off.data.design?.enabled, false);
  console.log('PASS: Arena off → design.enabled false (classic)');

  await request('/api/admin/menu-design', 'PUT', { enabled: true }, urban.cookie, 200, urbanId);
  const on = await request(`/api/menu/public/${urbanId}`, 'GET', undefined, '', 200);
  assert.equal(on.data.design?.enabled, true);
  console.log('PASS: Arena on → design.enabled true');

  const sibling = await withTempPassword('manager+drive-through-cafe@restore.local');
  assert.notEqual(sibling.cafeId, urbanId);

  const forged = await request(
    '/api/admin/menu-design',
    'PUT',
    { restaurantId: urbanId, enabled: false, settings: { hero: { titleLine1: 'HACK' } } },
    sibling.cookie,
    undefined,
    sibling.cafeId,
  );
  assert.equal(forged.status, 403, `expected 403, got ${forged.status}: ${JSON.stringify(forged.data)}`);
  console.log('PASS: other café manager gets 403 when targeting Urban design');

  const siblingGet = await request('/api/admin/menu-design', 'GET', undefined, sibling.cookie, 200, sibling.cafeId);
  assert.equal(siblingGet.data.restaurantId, sibling.cafeId);

  // Urban session may still be valid (password rotation does not invalidate by default unless login version changes)
  let urbanCookie = urban.cookie;
  const authCheck = await request('/api/auth/user', 'GET', undefined, urbanCookie);
  if (authCheck.status !== 200) {
    // re-issue urban temp password (hash already replaced once; use restores entry)
    const urbanRestore = restores.find((r) => r.cafeId === urbanId)!;
    const password = `Phase2Gate-retry-${Date.now()}`;
    await pool.query(`update users set password = $1, updated_at = now() where id = $2`, [
      await bcrypt.hash(password, 12),
      urbanRestore.id,
    ]);
    urbanCookie = (await tryLogin(urbanRestore.email, password))!;
  }

  await request('/api/admin/menu-design', 'PUT', { enabled: originalEnabled, settings: originalSettings }, urbanCookie, 200, urbanId);
  const reverted = await request(`/api/menu/public/${urbanId}`, 'GET', undefined, '', 200);
  assert.equal(reverted.data.design?.enabled, originalEnabled);
  assert.deepEqual(reverted.data.design?.settings || {}, originalSettings);
  console.log('PASS: Urban design reverted');

  console.log('ARENA PHASE 2 GATE: all checks passed');
} finally {
  for (const r of restores) {
    await pool.query(`update users set password = $1, updated_at = now() where id = $2`, [r.hash, r.id]);
  }
  if (restores.length) console.log(`Restored ${restores.length} manager password hash(es)`);
  await pool.end();
}
