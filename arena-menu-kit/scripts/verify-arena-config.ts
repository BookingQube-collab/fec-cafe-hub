// Run: npx tsx scripts/verify-arena-config.ts   (add to "npm test")
// Checks the payload -> Arena config mapping with an API-shaped fixture. Uses stub helpers, so it needs no server or DB.
import assert from 'node:assert/strict';
import { buildArenaConfig, type PublicMenu } from '../client/src/menu-arena/buildArenaConfig';

const cat = (id: string, title: string, order: number) => ({ id, title, order });
const item = (id: string, categoryId: string, name: string, price: string, order: number, extra: Partial<PublicMenu['items'][number]> = {}) =>
  ({ id, categoryId, name, price, discount: '0.00', imageUrl: null, isAvailable: true, specialDate: null, hasMultiplePricing: false, order, ...extra });

const menu: PublicMenu = {
  restaurant: { id: 'r1', name: 'Urban Café', currency: 'QAR', logoUrl: '/objects/logo' },
  categories: [cat('c3', 'Hot Coffee', 2), cat('c1', 'Pizza', 0), cat('c2', 'Desserts', 1), cat('c4', 'Empty', 3)],
  items: [
    item('i2', 'c1', 'Pepperoni', '16.00', 1),
    item('i1', 'c1', 'Margherita', '14.00', 0),
    item('i3', 'c1', 'Hidden pizza', '9.00', 2, { isAvailable: false }),
    item('i4', 'c2', 'Brownie', '12.00', 0, { discount: '25.00', imageUrl: '/objects/brownie' }),
    item('i5', 'c3', 'Espresso', '10.00', 0, { hasMultiplePricing: true }),
  ],
  variants: [
    { menuItemId: 'i5', label: 'Double', price: '12.00', discount: '0.00', order: 1 },
    { menuItemId: 'i5', label: 'Single', price: '10.00', discount: '0.00', order: 0 },
  ],
};
const helpers = {
  isItemVisible: (i: PublicMenu['items'][number]) => i.isAvailable !== false,
  arabicForItem: (n: string) => (n === 'Pepperoni' ? 'بيبروني (lib)' : ''),
  arabicForCategory: () => '',
  groupForCategory: (c: PublicMenu['categories'][number]) => (c.title === 'Hot Coffee' ? 'drinks' as const : 'food' as const),
};

const cfg = buildArenaConfig(menu, null, helpers);
assert.deepEqual(cfg.categories.map((c) => c.nameEn), ['Pizza', 'Desserts', 'Hot Coffee'], 'order by category order, food before drinks, empty skipped');
assert.deepEqual(cfg.categories[0].items.map((i) => i.nameEn), ['Margherita', 'Pepperoni'], 'item order + hidden items removed');
assert.equal(cfg.categories[0].items[0].price, 14, 'string price -> number without .00');
assert.equal(cfg.categories[0].items[0].nameAr, 'مارغريتا', 'Arabic fallback from defaults');
assert.equal(cfg.categories[0].items[1].nameAr, 'بيبروني (lib)', 'app translation wins over defaults');
assert.equal(cfg.categories[0].bannerUrl, '/assets/arena/banners/pizza.webp', 'known category gets default banner');
const brownie = cfg.categories[1].items[0];
assert.equal(brownie.price, 9, 'discount applied');
assert.equal(brownie.tag, '-25%', 'discount tag');
assert.equal(cfg.categories[1].iconUrl, '/objects/brownie', 'unknown category icon falls back to first item photo');
const esp = cfg.categories[2].items[0];
assert.equal(esp.price, null); assert.equal(esp.priceText, '10 / 12', 'variants sorted and joined');
assert.equal(esp.tag, 'Single · Double', 'variant labels shown when not in the name');
assert.equal(cfg.brand.currency, 'QR'); assert.equal(cfg.brand.logoUrl, '/objects/logo', 'café logo used');
assert.equal(cfg.hero.titleLine1, 'Urban', 'hero from café name when no override');
assert.equal(cfg.hero.titleLine2, 'Café', 'hero second line from café name');
assert.equal(cfg.seo.title, 'Urban Café | Menu', 'seo title from café name');
assert.equal(cfg.brand.logoAlt, 'Urban Café', 'logo alt from café name');
assert.equal(cfg.brand.showSocial, false, 'sample social hidden until café overrides');

const other = buildArenaConfig({ ...menu, restaurant: { ...menu.restaurant, name: 'Drive Through Café', logoUrl: null } }, null, helpers);
assert.equal(other.hero.titleLine1, 'Drive');
assert.equal(other.hero.titleLine2, 'Through Café');
assert.equal(other.seo.title, 'Drive Through Café | Menu');

const custom = buildArenaConfig(menu, { hero: { titleLine1: 'Hello' }, categories: { c2: { group: 'drinks', hue: '#123456' } } }, helpers);
assert.equal(custom.hero.titleLine1, 'Hello', 'saved override applied');
assert.equal(custom.hero.titleLine2, 'Café', 'unsaved hero line still follows café name');
assert.equal(custom.categories.find((c) => c.nameEn === 'Desserts')!.group, 'drinks', 'category override applied');
assert.equal(custom.categories.find((c) => c.nameEn === 'Desserts')!.hue, '#123456');
console.log('PASS: arena config mapping (order, visibility, prices, discounts, variants, Arabic, visuals, overrides).');
