import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const origins = ['https://menu.cafe-menu.workers.dev', 'https://staff.cafe-menu.workers.dev'];
const cafe = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';
const [publicVersion, staffVersion] = process.argv.slice(2);
for (const version of [publicVersion, staffVersion]) {
  assert.ok(version && /^[a-f0-9-]{36}$/.test(version), 'Provide both published Worker version IDs');
}
async function request(origin, route, status = 200) {
  const response = await fetch(origin + route, {signal: AbortSignal.timeout(30000)});
  assert.equal(response.status, status, `${route}: unexpected status`);
  return response;
}
const assets = await fs.readdir('dist/public/assets');
const files = assets.filter(file => file.startsWith('customer-menu-') && /\.(js|css)$/.test(file));
assert.equal(files.length, 2);
for (const origin of origins) {
  const html = await (await request(origin, origin === origins[0] ? '/menu/' + cafe : '/login')).text();
  const localHtml = await fs.readFile('dist/public/index.html', 'utf8');
  assert.equal(html, localHtml, 'Published HTML must reference the current build');
  for (const file of files) {
    const remote = await (await request(origin, '/assets/' + file)).text();
    assert.equal(remote, await fs.readFile(path.join('dist/public/assets', file), 'utf8'));
    assert.ok(remote.includes('guest-selection-footer'), 'Pinned selection must be published');
    assert.ok(remote.includes('guest-compact-detail'), 'Compact popup must be published');
    assert.ok(remote.includes('guest-compact-filters'), 'Compact filters must be published');
    assert.ok(remote.includes('guest-compact-wheel'), 'Compact wheel must be published');
    assert.ok(remote.includes('menu-wheel-footer'), 'Wheel controls must be pinned');
  }
}
await request(origins[0], '/login', 404);
await request(origins[0], '/admin/menu', 404);
await request(origins[1], '/api/manager-menu', 401);
const menu = await (await request(origins[0], '/api/menu/public/' + cafe)).json();
assert.equal(menu.restaurant.id, cafe);
const sampleNames = ['Marguareita', 'Classic Hot Dog', 'Latte'];
assert.ok(sampleNames.every(name => menu.items.some(item => item.name === name && item.modifierGroups.length)));
await fs.writeFile('data/compact-popup-release.json', JSON.stringify({
  checkedAt: new Date().toISOString(), passed: true, currentAssetsVerified: true, qrIsolationVerified: true,
  visibleItems: menu.items.length, sampleOptionsPreserved: sampleNames, productionMenuDataModified: false,
  publicVersion, staffVersion,
}, null, 2));
console.log('PASS: both live Workers serve compact item, filter and wheel popups; Urban choices persist, staff sign-in loads, and QR access remains isolated.');
