// Run: npx tsx scripts/verify-arena-config.ts   (add to "npm test")
// Checks the payload -> Arena config mapping with an API-shaped fixture. Uses stub helpers, so it needs no server or DB.
import assert from 'node:assert/strict';
import { blendFloaters, buildArenaConfig, mergeDesignSettings, type PublicMenu } from '../client/src/menu-arena/buildArenaConfig';
import designDefaults from '../client/src/menu-arena/arena-default-design.json';

const cat = (id: string, title: string, order: number) => ({ id, title, order });
const item = (id: string, categoryId: string, name: string, price: string, order: number, extra: Partial<PublicMenu['items'][number]> = {}) =>
  ({ id, categoryId, name, price, discount: '0.00', imageUrl: null, isAvailable: true, specialDate: null, hasMultiplePricing: false, order, ...extra });

const menu: PublicMenu = {
  restaurant: { id: 'r1', name: 'Urban Café', currency: 'QAR', logoUrl: '/objects/logo' },
  categories: [cat('c3', 'Hot Coffee', 2), cat('c1', 'Pizza', 0), cat('c2', 'Desserts', 1), cat('c4', 'Empty', 3)],
  items: [
    item('i2', 'c1', 'Pepperoni', '16.00', 1, { imageUrl: '/objects/pepperoni' }),
    item('i1', 'c1', 'Margherita', '14.00', 0, { imageUrl: '/objects/margherita' }),
    item('i3', 'c1', 'Hidden pizza', '9.00', 2, { isAvailable: false }),
    item('i4', 'c2', 'Brownie', '12.00', 0, { discount: '25.00', imageUrl: '/objects/brownie' }),
    item('i5', 'c3', 'Espresso', '10.00', 0, { hasMultiplePricing: true, imageUrl: '/objects/espresso' }),
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
assert.equal(cfg.categories[0].iconUrl, '/objects/margherita', 'live item photo preferred over hardcoded category icon');
const esp = cfg.categories[2].items[0];
assert.equal(esp.price, null); assert.equal(esp.priceText, '10 / 12', 'variants sorted and joined');
assert.equal(esp.tag, 'Single · Double', 'variant labels shown when not in the name');
assert.equal(cfg.brand.currency, 'QR'); assert.equal(cfg.brand.logoUrl, '/objects/logo', 'café logo used');
assert.equal(cfg.venue.name, 'Urban Café', 'venue from public API');
assert.equal(cfg.hero.titleLine1, 'Urban', 'hero derived from restaurant name when unset');
assert.equal(cfg.hero.titleLine2, 'Café', 'hero second line from restaurant name');
assert.equal(cfg.seo.title, 'Urban Café | Menu', 'SEO derived from restaurant name');
assert.equal(cfg.brand.showSocial, false, 'Urban Instagram defaults not applied to other cafés');
assert.equal(cfg.groups[0].floaters[0], '/objects/margherita', 'food floaters prefer live item photos');
assert.equal(cfg.groups[0].card.imageUrl, '/objects/margherita', 'food card prefers first live photo');
assert.equal(cfg.groups[1].floaters[0], '/objects/espresso', 'drinks floaters prefer live item photos');
assert.ok(cfg.groups[0].floaters[3]?.startsWith('/assets/arena/'), 'remaining floater slots keep decorative defaults');

// Per-slot helper: explicit saved URL wins; null/unset yields live then decorative.
assert.deepEqual(
  blendFloaters(
    ['/live/a', '/live/b'],
    ['/d/1', '/d/2', '/d/3', '/d/4', '/d/5', '/d/6', '/d/7', '/d/8', '/d/9'],
    ['/saved/1', null, '/saved/3', null, null, null, null, null, null],
  ),
  ['/saved/1', '/live/a', '/saved/3', '/live/b', '/d/5', '/d/6', '/d/7', '/d/8', '/d/9'],
  'blendFloaters precedence: saved > live > decorative',
);

// Manager-saved floater URLs must beat live menu photos; empty slots still auto-fill.
const foodFloaters = [
  '/assets/arena/floaters/food-9.webp',
  null,
  '/assets/arena/floaters/food-3.webp',
  null, null, null, null, null, null,
];
const floaterOverride = buildArenaConfig(menu, {
  groups: (designDefaults as any).groups.map((g: any) =>
    g.key === 'food' ? { ...g, floaters: foodFloaters } : g,
  ),
}, helpers);
assert.equal(floaterOverride.groups[0].floaters[0], '/assets/arena/floaters/food-9.webp', 'saved floater slot wins over live item photo');
assert.equal(floaterOverride.groups[0].floaters[1], '/objects/margherita', 'empty saved floater slot still takes live photo');
assert.equal(floaterOverride.groups[0].floaters[2], '/assets/arena/floaters/food-3.webp', 'second saved floater slot wins');
assert.equal(floaterOverride.groups[0].floaters[3], '/objects/pepperoni', 'later empty slots keep consuming live photos');
assert.ok(floaterOverride.groups[0].floaters[5]?.startsWith('/assets/arena/'), 'leftover slots keep decorative defaults');

// Partial groups[] (floater-only save) must keep default bg/card chrome — admin editor reads group.bg.
const floaterOnlySettings = {
  groups: [
    { key: 'food', floaters: ['/assets/arena/floaters/food-9.webp', null, null, null, null, null, null, null, null] },
    { key: 'drinks', floaters: Array(9).fill(null) },
  ],
};
const { categoryVisualsByTitle: _cv, itemArabicByName: _ia, categoryFallback: _cf, ...designChrome } = designDefaults as any;
void _cv; void _ia; void _cf;
const partialMerged = mergeDesignSettings(designChrome, floaterOnlySettings);
assert.equal(partialMerged.groups[0].bg.inner, (designDefaults as any).groups[0].bg.inner, 'partial groups merge keeps bg');
assert.equal(partialMerged.groups[0].card.label, (designDefaults as any).groups[0].card.label, 'partial groups merge keeps card');
assert.equal(partialMerged.groups[0].floaters[0], '/assets/arena/floaters/food-9.webp', 'partial groups merge keeps floater override');
const partialCfg = buildArenaConfig(menu, floaterOnlySettings, helpers);
assert.equal(partialCfg.groups[0].bg.inner, (designDefaults as any).groups[0].bg.inner, 'buildArenaConfig keeps group chrome with floater-only save');
assert.equal(partialCfg.groups[0].floaters[0], '/assets/arena/floaters/food-9.webp', 'floater-only save still wins slot 0');

const custom = buildArenaConfig(menu, { hero: { titleLine1: 'Hello' }, categories: { c2: { group: 'drinks', hue: '#123456' } } }, helpers);
assert.equal(custom.hero.titleLine1, 'Hello', 'saved override applied');
assert.equal(custom.hero.titleLine2, 'Café', 'unsaved hero fields still derive from venue');
assert.equal(custom.categories.find((c) => c.nameEn === 'Desserts')!.group, 'drinks', 'category override applied');
assert.equal(custom.categories.find((c) => c.nameEn === 'Desserts')!.hue, '#123456');

const other = buildArenaConfig({ ...menu, restaurant: { ...menu.restaurant, name: 'Drive Through Café', logoUrl: null } }, null, helpers);
assert.equal(other.hero.titleLine1, 'Drive');
assert.equal(other.hero.titleLine2, 'Through Café');
assert.equal(other.seo.title, 'Drive Through Café | Menu');

console.log('PASS: arena config mapping (order, visibility, prices, discounts, variants, Arabic, live photos, venue chrome, overrides).');
