// Mutates only the disposable UI-audit café; never accepts a production origin.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture = JSON.parse(await fs.readFile('data/ui-audit-private.json', 'utf8'));
assert.equal(fixture.origin, 'http://127.0.0.1:5102');
const action = process.argv[2];
assert.ok(['hide', 'show', 'verify-hidden', 'verify-visible', 'rename', 'verify-save'].includes(action));
let cookie = '';
async function request(method, pathname, body) {
  const res = await fetch(fixture.origin + pathname, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Cafe-Context': fixture.cafeId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(res.ok, `${method} ${pathname}: ${res.status}`);
  const next = res.headers.getSetCookie();
  if (next.length) cookie = next.map(c => c.split(';')[0]).join('; ');
  return res.json();
}
try {
  await request('POST', '/api/login', { email: fixture.platformEmail, password: fixture.password });
  await request('POST', '/api/super-admin/cafe-access', { restaurantId: fixture.cafeId });
  const menu = await request('GET', '/api/manager-menu');
  const item = menu.items.find(i => i.name === 'Marguareita' || i.name === 'Sync test pizza');
  assert.ok(item);
  if (action === 'hide' || action === 'show') {
    await request('PUT', `/api/super-admin/menu-items/${item.id}`, { isAvailable: action === 'show' });
    console.log(`Independent super-admin session set ${item.name} ${action === 'show' ? 'visible' : 'hidden'}.`);
  } else if (action === 'rename') {
    await request('PUT', `/api/super-admin/restaurants/${fixture.cafeId}`, { name: 'Admin sync verified café' });
    console.log('Independent admin changed café name.');
  } else if (action === 'verify-save') {
    assert.equal(item.name, 'Sync test pizza'); assert.equal(Number(item.price), 22);
    console.log('Manager item edit persisted with the exact confirmed name and price.');
  } else {
    assert.equal(item.isAvailable, action === 'verify-visible');
    const bundle = await request('GET', `/api/menu/public/${fixture.cafeId}`);
    assert.equal(bundle.items.some(i => i.id === item.id), action === 'verify-visible');
    console.log(`Database and guest bundle agree: ${item.name} is ${action === 'verify-visible' ? 'visible' : 'hidden'}.`);
  }
} finally {
  if (cookie) await fetch(fixture.origin + '/api/logout', { method: 'POST', headers: { Cookie: cookie } });
}
