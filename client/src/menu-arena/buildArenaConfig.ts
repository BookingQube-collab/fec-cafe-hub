// Turns this app's public menu payload (GET /api/menu/public/:id) + the café's design settings
// into the config the Arena design reads. Pure function — easy to test.
//
// WIRE THE HELPERS to the app's existing libs (do not re-implement them):
//   isItemVisible     -> the same availability / special_date rule the classic customer page uses
//   arabicForItem     -> client/src/lib/menuLanguage.tsx translation for an item name (or '')
//   arabicForCategory -> client/src/lib/menuLanguage.tsx translation for a category title (or '')
//   groupForCategory  -> client/src/lib/menuDiscovery.ts: 'Drinks' -> 'drinks', everything else -> 'food'
import { MenuConfigSchema, type MenuConfig } from './config';
import defaults from './arena-default-design.json';

export type PublicMenu = {
  restaurant: { id: string; name: string; currency: string; logoUrl: string | null };
  categories: { id: string; title: string; order: number }[];
  items: {
    id: string; categoryId: string; name: string; price: string | number; discount?: string | number | null;
    imageUrl?: string | null; isAvailable?: boolean; specialDate?: string | null; hasMultiplePricing?: boolean; order: number;
  }[];
  variants?: { menuItemId: string; label: string; price: string | number; discount?: string | number | null; order: number }[];
};

export type ArenaHelpers = {
  isItemVisible: (item: PublicMenu['items'][number]) => boolean;
  arabicForItem: (name: string) => string;
  arabicForCategory: (title: string) => string;
  groupForCategory: (category: PublicMenu['categories'][number], items: PublicMenu['items']) => 'food' | 'drinks';
};

type CategoryVisual = { group?: string; nameAr?: string; hue?: string; bannerUrl?: string | null; iconUrl?: string | null };
type DesignSettings = Record<string, any> & { categories?: Record<string, CategoryVisual> };

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Deep merge: objects merge, arrays and scalars from `over` replace `base` (null/undefined in `over` keep base). */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined || over === null ? base : (over as T));
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out as T;
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const finalPrice = (price: unknown, discount: unknown) => {
  const p = num(price) * (1 - num(discount) / 100);
  return Math.round(p * 100) / 100;           // 14 stays 14, 12.5 stays 12.5
};
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'category';
const currencyLabel = (c: string) => (c?.toUpperCase() === 'QAR' ? 'QR' : c);

export function buildArenaConfig(menu: PublicMenu, saved: DesignSettings | null | undefined, h: ArenaHelpers): MenuConfig {
  const { categoryVisualsByTitle, itemArabicByName, categoryFallback, ...baseDesign } = defaults as any;
  const d = deepMerge(baseDesign, saved ?? {}) as any;
  const overrides: Record<string, CategoryVisual> = (saved?.categories ?? {}) as any;

  const variantsByItem = new Map<string, NonNullable<PublicMenu['variants']>>();
  for (const v of menu.variants ?? []) {
    if (!variantsByItem.has(v.menuItemId)) variantsByItem.set(v.menuItemId, []);
    variantsByItem.get(v.menuItemId)!.push(v);
  }

  const usedSlugs = new Set<string>();
  const categories = [...menu.categories]
    .sort((a, b) => a.order - b.order)
    .map((cat) => {
      const catItems = menu.items.filter((i) => i.categoryId === cat.id && h.isItemVisible(i)).sort((a, b) => a.order - b.order);
      if (!catItems.length) return null;

      const byTitle: CategoryVisual = categoryVisualsByTitle[cat.title.toLowerCase()] ?? {};
      const ov = overrides[cat.id] ?? {};
      const pick = <K extends keyof CategoryVisual>(k: K) => (ov[k] ?? byTitle[k] ?? (categoryFallback as any)[k] ?? null) as CategoryVisual[K];

      let slug = slugify(cat.title);
      for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(cat.title)}-${n}`;
      usedSlugs.add(slug);

      const items = catItems.map((it) => {
        const variants = (variantsByItem.get(it.id) ?? []).sort((a, b) => a.order - b.order);
        const discount = num(it.discount);
        let price: number | null = finalPrice(it.price, discount);
        let priceText: string | null = null;
        const tags: string[] = [];
        if (it.hasMultiplePricing && variants.length) {
          price = null;
          priceText = variants.map((v) => finalPrice(v.price, v.discount)).join(' / ');
          const labels = variants.map((v) => v.label).filter(Boolean);
          const inName = labels.every((l) => it.name.toLowerCase().includes(l.toLowerCase()));
          if (labels.length && !inName) tags.push(labels.join(' · '));
        }
        if (discount > 0) tags.push(`-${discount}%`);
        return {
          nameEn: it.name,
          nameAr: h.arabicForItem(it.name) || itemArabicByName[it.name.toLowerCase()] || '',
          price, priceText,
          tag: tags.length ? tags.join(' ') : null,
          soldOut: false,
        };
      });

      return {
        slug,
        group: (ov.group ?? byTitle.group ?? h.groupForCategory(cat, catItems)) as string,
        nameEn: cat.title,
        nameAr: ov.nameAr || h.arabicForCategory(cat.title) || byTitle.nameAr || '',
        hue: pick('hue') as string,
        bannerUrl: pick('bannerUrl') ?? null,
        iconUrl: pick('iconUrl') ?? catItems.find((i) => i.imageUrl)?.imageUrl ?? null,
        items,
      };
    })
    .filter(Boolean) as MenuConfig['categories'];

  // Design shows groups in this order: food first, then drinks (matches the hero cards)
  const groupRank = (g: string) => d.groups.findIndex((x: any) => x.key === g);
  categories.sort((a, b) => groupRank(a.group) - groupRank(b.group));   // stable: keeps admin order inside a group

  const config = {
    version: 1 as const,
    venue: { slug: slugify(menu.restaurant.name), name: menu.restaurant.name },
    ...d,
    brand: {
      ...d.brand,
      logoUrl: d.brand.logoUrl || menu.restaurant.logoUrl || d.brand.fallbackLogoUrl,
      logoAlt: d.brand.logoAlt || menu.restaurant.name,
      currency: currencyLabel(menu.restaurant.currency || d.brand.currency),
    },
    categories,
  };
  delete (config.brand as any).fallbackLogoUrl;
  return MenuConfigSchema.parse(config);
}
