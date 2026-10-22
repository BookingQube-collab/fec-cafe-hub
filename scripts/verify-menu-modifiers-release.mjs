import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const publicOrigin = 'https://menu.cafe-menu.workers.dev';
const staffOrigin = 'https://staff.cafe-menu.workers.dev';
const cafeIds = ['fe7f873f-acd2-483b-8258-a06528a2a8f7', '4fb514c8-9d8c-441b-a92b-aa2b72bfbede', 'a3fc34fa-ce03-4cda-8cc9-4020ee55f9b1'];
async function request(origin, route, expected = 200, init = {}) {
  const response = await fetch(origin + route, { ...init, signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, expected, `${route}: unexpected HTTP status`);
  return response;
}
const counts = [];
for (const id of cafeIds) {
  const data = await (await request(publicOrigin, '/api/menu/public/' + id)).json();
  assert.equal(data.restaurant.id, id);
  assert.ok(data.items.every(item => Array.isArray(item.modifierGroups)));
  counts.push({ id, visibleItems: data.items.length, configuredItems: data.items.filter(item => item.modifierGroups.length).length });
}
await request(publicOrigin, '/login', 404);
await request(publicOrigin, '/admin/menu', 404);
await request(publicOrigin, '/api/manager-menu', 404);
await request(staffOrigin, '/api/manager-menu', 401);
await request(staffOrigin, '/login');
const saved = await fs.readFile('URBAN-CAFE-CREDENTIALS.txt', 'utf8');
const email = 'manager@urban.cafe';
const password = saved.slice(saved.indexOf(`Email: ${email}`)).match(/Password: (.+)/)?.[1];
assert.ok(password, 'Existing manager credentials must be available privately');
let cookie = '';
try {
  const login = await request(staffOrigin, '/api/login', 200, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: staffOrigin }, body: JSON.stringify({ email, password }) });
  cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
  assert.ok(cookie.startsWith('__Host-cafe.sid='));
  const manager = await (await request(staffOrigin, '/api/manager-menu', 200, { headers: { Cookie: cookie } })).json();
  assert.equal(manager.restaurant.id, cafeIds[0]);
  assert.ok(manager.items.every(item => Array.isArray(item.modifierGroups)));
  const templates = await (await request(staffOrigin, '/api/menu-library', 200, { headers: { Cookie: cookie } })).json();
  assert.ok(templates.every(item => Array.isArray(item.modifierGroups)));
  const assets = await fs.readdir('dist/public/assets');
  for (const [prefix, origin, text] of [['manager-menu-', staffOrigin, 'Toppings & custom choices'], ['customer-menu-', publicOrigin, 'Make it yours']]) {
    const file = assets.find(file => file.startsWith(prefix) && file.endsWith('.js'));
    assert.ok(file);
    const remote = await (await request(origin, '/assets/' + file)).text();
    assert.equal(remote, await fs.readFile(path.join('dist/public/assets', file), 'utf8'));
    assert.ok(remote.includes(text), 'New feature must be present in published assets');
  }
  const result = { passed: true, publicVersion: 'b7af8a25-247e-493d-ade3-c0b8361e8373', staffVersion: '144880a6-6078-4392-aeab-155407b8ae49',
    urls: { customer: publicOrigin, staff: staffOrigin }, cafes: counts, managerItems: manager.items.length, libraryItems: templates.length,
    staffReadVerified: true, latestAssetsVerified: true, qrIsolationVerified: true, productionMenuDataModified: false, checkedAt: new Date().toISOString() };
  await fs.writeFile('data/menu-modifiers-release.json', JSON.stringify(result, null, 2));
  console.log('PASS: both live Workers serve the verified release; all three café menus, manager editor data, library customization and QR isolation are working.');
} finally {
  if (cookie) await request(staffOrigin, '/api/logout', 200, { method: 'POST', headers: { Cookie: cookie, Origin: staffOrigin, 'Content-Type': 'application/json' }, body: '{}' });
}
