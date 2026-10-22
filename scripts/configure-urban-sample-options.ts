import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { menuModifierGroupsSchema, type MenuModifierGroup, type MenuItem, type PriceVariant, type Category } from '../shared/schema';

const staff = process.env.MANAGEMENT_ORIGIN || process.env.PUBLIC_URL || 'http://localhost:5100', guest = process.env.PUBLIC_URL || process.env.PUBLIC_MENU_ORIGIN || 'http://localhost:5100';
const urban = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';
const names = ['Marguareita', 'Classic Hot Dog', 'Latte'];
type Menu = { restaurant: { id: string; currency: string }; items: MenuItem[]; variants: PriceVariant[]; categories: Category[] };
let cookie = '';
async function api(route: string, method = 'GET', body?: unknown, origin = staff) {
  const response = await fetch(origin + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(origin === staff && cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${method} ${route}: unexpected HTTP status ${response.status}`);
  if (route === '/api/login') cookie = response.headers.get('set-cookie')?.split(';')[0] || '';
  return response.json();
}
const choice = (label: string, labelAr: string, price = '0', isAvailable = true) => ({ id: randomUUID(), label, labelAr, price, isAvailable });
const group = (title: string, titleAr: string, selection: 'single' | 'multiple', minSelections: number, maxSelections: number, options: MenuModifierGroup['options']): MenuModifierGroup =>
  ({ id: randomUUID(), title, titleAr, selection, minSelections, maxSelections, options });
const samples: Record<string, MenuModifierGroup[]> = {
  Marguareita: [group('Sample toppings (testing)', 'إضافات تجريبية (للاختبار)', 'multiple', 0, 2, [
    choice('Extra cheese', 'جبن إضافي', '3'), choice('Olives', 'زيتون', '1.50'), choice('Sweet corn', 'ذرة حلوة', '1.50'), choice('Mushrooms', 'فطر', '2', false),
  ])],
  'Classic Hot Dog': [
    group('Sample sauce (testing)', 'صلصة تجريبية (للاختبار)', 'single', 1, 1, [choice('Classic ketchup', 'كاتشب كلاسيكي'), choice('Mustard', 'خردل'), choice('Spicy sauce', 'صلصة حارة', '1')]),
    group('Sample toppings (testing)', 'إضافات تجريبية (للاختبار)', 'multiple', 0, 2, [choice('Cheese', 'جبن', '2'), choice('Onions', 'بصل'), choice('Pickles', 'مخلل'), choice('Crispy onions', 'بصل مقرمش', '1', false)]),
  ],
  Latte: [group('Sample milk choice (testing)', 'اختيار حليب تجريبي (للاختبار)', 'single', 1, 1, [
    choice('Regular milk', 'حليب عادي'), choice('Oat milk', 'حليب الشوفان', '2'), choice('Almond milk', 'حليب اللوز', '3', false),
  ])],
};
try {
  const saved = await fs.readFile('URBAN-CAFE-CREDENTIALS.txt', 'utf8'), email = 'manager@urban.cafe';
  const password = saved.slice(saved.indexOf(`Email: ${email}`)).match(/Password: (.+)/)?.[1];
  assert.ok(password, 'Existing manager credentials are stored privately');
  await api('/api/login', 'POST', { email, password });
  assert.ok(cookie.startsWith('__Host-cafe.sid='));
  const before = await api('/api/manager-menu') as Menu;
  assert.equal(before.restaurant.id, urban);
  assert.equal(before.restaurant.currency, 'QAR');
  const selected = names.map(name => {
    const matches = before.items.filter(item => item.name === name);
    assert.equal(matches.length, 1, `Find exactly one ${name}`);
    return matches[0];
  });
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(selected.map(item => ({ id: item.id, name: item.name, price: item.price, discount: item.discount, unit: item.unit, visible: item.isAvailable,
      groups: item.modifierGroups.length, multiplePricing: item.hasMultiplePricing, variants: before.variants.filter(v => v.menuItemId === item.id).map(({ label, price, discount }) => ({ label, price, discount })) })), null, 2));
  } else {
    for (const item of selected) {
      assert.equal(item.isAvailable, true, `${item.name} must already be visible`);
      assert.equal(item.modifierGroups.length, 0, `${item.name} already has choices; never overwrite existing configuration`);
      assert.equal(item.hasMultiplePricing, false, `${item.name} already has size variants; preserve them`);
      assert.equal(before.variants.filter(v => v.menuItemId === item.id).length, 0);
      menuModifierGroupsSchema.parse(samples[item.name]);
    }
    const backupFile = `data/urban-sample-options-backup-${Date.now()}.json`;
    await fs.writeFile(backupFile, JSON.stringify({ cafe: urban, createdAt: new Date().toISOString(), items: selected, variants: before.variants.filter(v => selected.some(item => item.id === v.menuItemId)), plannedGroups: samples }, null, 2));
    for (const item of selected) {
      const variants = item.name === 'Latte' ? [
        { label: 'Regular · عادي (sample)', price: item.price, discount: item.discount || '0', unit: item.unit },
        { label: 'Large · كبير (sample)', price: (Number(item.price) + 3).toFixed(2), discount: item.discount || '0', unit: item.unit },
      ] : [];
      await api('/api/manager-menu', 'POST', { id: item.id, expectedUpdatedAt: new Date(item.updatedAt!).toISOString(),
        item: { categoryId: item.categoryId, name: item.name, price: item.price, discount: item.discount || '0', hasMultiplePricing: variants.length > 0, modifierGroups: samples[item.name] }, variants });
      console.log(`Saved sample choices: ${item.name}`);
    }
    const after = await api('/api/manager-menu') as Menu;
    assert.deepEqual(after.restaurant, before.restaurant); assert.deepEqual(after.categories, before.categories);
    assert.equal(after.items.length, before.items.length);
    assert.deepEqual(after.items.filter(i => !selected.some(s => s.id === i.id)), before.items.filter(i => !selected.some(s => s.id === i.id)));
    assert.deepEqual(after.variants.filter(v => !selected.some(s => s.id === v.menuItemId)), before.variants.filter(v => !selected.some(s => s.id === v.menuItemId)));
    const publicMenu = await api('/api/menu/public/' + urban, 'GET', undefined, guest) as Menu;
    const report = selected.map(original => {
      const item = after.items.find(i => i.id === original.id)!;
      const { modifierGroups: ignoredGroups, hasMultiplePricing: ignoredMultiple, updatedAt: ignoredTime, ...preserved } = item;
      const { modifierGroups: oldGroups, hasMultiplePricing: oldMultiple, updatedAt: oldTime, ...oldPreserved } = original;
      assert.deepEqual(preserved, oldPreserved, `${item.name}: retain existing item details, price and visibility`);
      assert.deepEqual(item.modifierGroups, samples[item.name]);
      assert.deepEqual(publicMenu.items.find(i => i.id === item.id)?.modifierGroups, samples[item.name]);
      const options = after.variants.filter(v => v.menuItemId === item.id);
      assert.equal(options.length, item.name === 'Latte' ? 2 : 0);
      assert.deepEqual(publicMenu.variants.filter(v => v.menuItemId === item.id), options);
      return { id: item.id, name: item.name, groups: item.modifierGroups.length, choices: item.modifierGroups.reduce((n, g) => n + g.options.length, 0), variants: options.length };
    });
    await fs.writeFile('data/urban-sample-options-release.json', JSON.stringify({ passed: true, cafe: urban, backupFile, items: report, otherItemsPreserved: true, livePublicDataVerified: true, checkedAt: new Date().toISOString() }, null, 2));
    console.log('PASS: sample choices are visible on the live Urban menu; original details, base prices, photos, visibility and other items preserved.');
  }
} finally { if (cookie) await api('/api/logout', 'POST', {}); }
