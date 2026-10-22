import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { arabicMenuLabel } from '../client/src/lib/menuLanguage';
import { menuSearchIndex, menuSearchQuery, matchesMenuSearch } from '../client/src/lib/menuSearch';
import { customizationTotal } from '../shared/menuCustomization';
import type { PublicMenuData } from '../shared/schema';

const origin = process.env.PUBLIC_URL || process.env.PUBLIC_MENU_ORIGIN || 'http://localhost:5100';
const cafe = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';
const response = await fetch(origin + '/api/menu/public/' + cafe);
assert.equal(response.status, 200);
const menu = await response.json() as PublicMenuData;
assert.equal(menu.restaurant.id, cafe);
assert.ok(menu.items.every(i => i.isAvailable));
assert.equal(new Set(menu.items.map(i => i.id)).size, menu.items.length);
const titles = new Map(menu.categories.map(c => [c.id, c.title]));
const indexed = menu.items.map(item => {
  assert.ok(titles.has(item.categoryId));
  const variants = menu.variants.filter(v => v.menuItemId === item.id);
  assert.ok(!item.hasMultiplePricing || variants.length);
  assert.notEqual(arabicMenuLabel(item.name), item.name, 'Existing Urban items should have Arabic display names');
  const choices = [...variants.map(v => v.label), ...item.modifierGroups.flatMap(g => [g.title, g.titleAr || '', ...g.options.filter(o => o.isAvailable).flatMap(o => [o.label, o.labelAr || ''])])];
  const category = titles.get(item.categoryId)!;
  return {item, index: [...menuSearchIndex(item, category, choices), ...menuSearchIndex({...item, name: arabicMenuLabel(item.name)}, arabicMenuLabel(category), choices.map(arabicMenuLabel))]};
});
const search = (text: string) => indexed.filter(r => matchesMenuSearch(r.index, menuSearchQuery(text))).map(r => r.item.name);
for (const [english, arabic] of [['pizza','بيتزا'], ['cold coffee','قهوة باردة'], ['drinks','مشروبات'], ['pizza mushroom','بيتزا مشروم']]) {
  assert.deepEqual(search(english), search(arabic), 'Search must work in either interface language');
}
assert.deepEqual(search('espresso double'), ['Espresso Single/Double']);
assert.deepEqual(search('اسبريسو دبل'), ['Espresso Single/Double']);
assert.deepEqual(search('zzzz-no-such-meal'), []);
const latte = menu.items.find(i => i.name === 'Latte')!;
const large = menu.variants.find(v => v.menuItemId === latte.id && v.label.startsWith('Large'))!;
const oat = latte.modifierGroups.flatMap(g => g.options).find(o => o.label === 'Oat milk')!;
assert.equal(customizationTotal(large.price, large.discount, [oat]), '20.00');
const imageUrls = [...new Set([menu.restaurant.logoUrl, menu.restaurant.coverMediaType !== 'video' ? menu.restaurant.coverMediaUrl : null, ...menu.items.map(i => i.imageUrl)].filter((s): s is string => !!s))];
const images: {url: string; status: number; contentType: string}[] = [];
for (let i = 0; i < imageUrls.length; i += 6) {
  const batch = await Promise.all(imageUrls.slice(i, i + 6).map(async url => {
    const image = await fetch(new URL(url, origin), {method: 'HEAD', signal: AbortSignal.timeout(30000)});
    return {url, status: image.status, contentType: image.headers.get('content-type') || ''};
  }));
  images.push(...batch);
}
const broken = images.filter(i => i.status !== 200 || !i.contentType.startsWith('image/'));
await fs.writeFile('data/live-guest-menu-data-audit.json', JSON.stringify({checkedAt: new Date().toISOString(), items: menu.items.length, categories: menu.categories.length, variants: menu.variants.length, imagesChecked: images.length, brokenImages: broken, bilingualSearch: true, sampleTotal: '20.00 QAR', productionDataModified: false}, null, 2));
assert.equal(broken.length, 0, 'All customer food images and logo must be accessible');
console.log(`PASS: ${menu.items.length} live items, bilingual search, variants, customization prices and ${images.length} public images; no live data changed.`);
