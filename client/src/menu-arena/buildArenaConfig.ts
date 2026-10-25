// Turns this app's public menu payload (GET /api/menu/public/:id) + the café's design settings
// into the config the Arena design reads. Pure function — easy to test.
//
// LIVE FROM /api/menu/public/:id (always wins for menu content):
//   restaurant.name / logoUrl / currency → venue, brand logo/currency, default hero/SEO when unset
//   categories[].title / order → category nameEn + order
//   items[].name / price / discount / imageUrl / availability → item rows, prices, floater/card photos
//   variants → multi-price text
//
// DESIGN CHROME from arena-default-design.json (and admin settings overrides):
//   theme, hero copy (if not overridden), groups layout, 3D/bubbles/marquee/stats/labels/effects
//   categoryVisualsByTitle / categoryFallback → hue/banner/icon only when title matches or no photo
//   itemArabicByName → Arabic only when menuLanguage helper has no translation
//   decorative floaters/cards → used only when the café has no item photos (or admin overrode floaters)
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

/**
 * Design settings merge for admin + Arena. `deepMerge` replaces arrays wholesale, so a
 * partial `groups: [{ key, floaters }]` save would wipe bg/card/label chrome and crash
 * the menu-design editor on `group.bg.*`. Merge groups by key instead.
 */
export function mergeDesignSettings(base: Record<string, any>, over: unknown): Record<string, any> {
  const o = isObj(over) ? over : {};
  const merged = deepMerge(base, o) as Record<string, any>;
  if (Array.isArray(base.groups)) {
    const overByKey = new Map(
      (Array.isArray(o.groups) ? o.groups : []).map((g: any) => [g.key, g]),
    );
    merged.groups = base.groups.map((g: any) => deepMerge(g, overByKey.get(g.key) || {}));
  }
  return merged;
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const finalPrice = (price: unknown, discount: unknown) => {
  const p = num(price) * (1 - num(discount) / 100);
  return Math.round(p * 100) / 100;           // 14 stays 14, 12.5 stays 12.5
};
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'category';
const currencyLabel = (c: string) => (c?.toUpperCase() === 'QAR' ? 'QR' : c);

function splitVenueTitle(name: string): { line1: string; line2: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { line1: parts[0] || 'Menu', line2: 'Menu' };
  return { line1: parts[0], line2: parts.slice(1).join(' ') };
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Build 9 floater slots with clear precedence per slot:
 *   1. Explicit non-empty URL from manager settings (always wins)
 *   2. Else next unused live menu item photo (only when the slot is empty/unset)
 *   3. Else decorative default from arena-default-design.json
 */
export function blendFloaters(
  live: string[],
  decorative: Array<string | null>,
  savedSlots?: Array<string | null> | null,
): Array<string | null> {
  const out: Array<string | null> = [];
  let liveIdx = 0;
  for (let i = 0; i < 9; i++) {
    const saved = savedSlots?.[i];
    if (typeof saved === 'string' && saved.length > 0) {
      out.push(saved);
      continue;
    }
    if (liveIdx < live.length) {
      out.push(live[liveIdx++]);
      continue;
    }
    out.push(decorative[i] ?? null);
  }
  return out;
}

export function buildArenaConfig(menu: PublicMenu, saved: DesignSettings | null | undefined, h: ArenaHelpers): MenuConfig {
  const { categoryVisualsByTitle, itemArabicByName, categoryFallback, ...baseDesign } = defaults as any;
  const d = mergeDesignSettings(baseDesign, saved ?? {}) as any;
  const overrides: Record<string, CategoryVisual> = (saved?.categories ?? {}) as any;
  const savedGroups = new Map<string, any>(
    (Array.isArray(saved?.groups) ? saved!.groups : []).map((g: any) => [g.key, g]),
  );

  const variantsByItem = new Map<string, NonNullable<PublicMenu['variants']>>();
  for (const v of menu.variants ?? []) {
    if (!variantsByItem.has(v.menuItemId)) variantsByItem.set(v.menuItemId, []);
    variantsByItem.get(v.menuItemId)!.push(v);
  }

  const photosByGroup = new Map<string, string[]>();
  const usedSlugs = new Set<string>();
  const categories = [...menu.categories]
    .sort((a, b) => a.order - b.order)
    .map((cat) => {
      const catItems = menu.items.filter((i) => i.categoryId === cat.id && h.isItemVisible(i)).sort((a, b) => a.order - b.order);
      if (!catItems.length) return null;

      const byTitle: CategoryVisual = categoryVisualsByTitle[cat.title.toLowerCase()] ?? {};
      const ov = overrides[cat.id] ?? {};
      const pick = <K extends keyof CategoryVisual>(k: K) => (ov[k] ?? byTitle[k] ?? (categoryFallback as any)[k] ?? null) as CategoryVisual[K];
      const group = (ov.group ?? byTitle.group ?? h.groupForCategory(cat, catItems)) as string;
      const itemPhotos = uniqueUrls(catItems.map((i) => i.imageUrl));
      if (itemPhotos.length) {
        const bucket = photosByGroup.get(group) ?? [];
        for (const url of itemPhotos) if (!bucket.includes(url)) bucket.push(url);
        photosByGroup.set(group, bucket);
      }

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

      // Icon: admin override → live item photo → title-matched chrome (Urban pack) → null
      const iconUrl = ov.iconUrl
        ?? catItems.find((i) => i.imageUrl)?.imageUrl
        ?? byTitle.iconUrl
        ?? (categoryFallback as any).iconUrl
        ?? null;

      return {
        slug,
        group,
        nameEn: cat.title,
        nameAr: ov.nameAr || h.arabicForCategory(cat.title) || byTitle.nameAr || '',
        hue: pick('hue') as string,
        bannerUrl: pick('bannerUrl') ?? null,
        iconUrl,
        items,
      };
    })
    .filter(Boolean) as MenuConfig['categories'];

  // Design shows groups in this order: food first, then drinks (matches the hero cards)
  const groupRank = (g: string) => d.groups.findIndex((x: any) => x.key === g);
  categories.sort((a, b) => groupRank(a.group) - groupRank(b.group));   // stable: keeps admin order inside a group

  const venueTitle = splitVenueTitle(menu.restaurant.name);
  // Decorative floaters come from the design pack defaults — not from deep-merged
  // settings — so a partial groups[] save cannot erase the fallback chrome.
  const defaultFloatersByKey = new Map<string, Array<string | null>>(
    (Array.isArray(baseDesign.groups) ? baseDesign.groups : []).map((g: any) => [g.key, g.floaters ?? []]),
  );
  const groups = d.groups.map((g: any) => {
    const sg = savedGroups.get(g.key);
    const live = photosByGroup.get(g.key) ?? [];
    // Manager-saved floater URLs always win; live photos only fill empty/unset slots.
    const floaters = blendFloaters(live, defaultFloatersByKey.get(g.key) ?? [], sg?.floaters);
    const cardImage = sg?.card?.imageUrl !== undefined ? g.card.imageUrl : (live[0] || g.card.imageUrl);
    const cardAlt = sg?.card?.imageAlt !== undefined
      ? g.card.imageAlt
      : (live[0] ? `${menu.restaurant.name} ${g.label}` : g.card.imageAlt);
    return {
      ...g,
      floaters,
      card: { ...g.card, imageUrl: cardImage, imageAlt: cardAlt },
    };
  });

  const config = {
    version: 1 as const,
    venue: { slug: slugify(menu.restaurant.name), name: menu.restaurant.name },
    ...d,
    seo: {
      ...d.seo,
      title: saved?.seo?.title ?? `${menu.restaurant.name} | Menu`,
      description: saved?.seo?.description ?? `Browse the full ${menu.restaurant.name} menu.`,
    },
    brand: {
      ...d.brand,
      logoUrl: d.brand.logoUrl || menu.restaurant.logoUrl || d.brand.fallbackLogoUrl || null,
      logoAlt: saved?.brand?.logoAlt ?? menu.restaurant.name,
      // Do not inherit Urban Instagram defaults onto other cafés unless the manager set them.
      socialLabel: saved?.brand?.socialLabel ?? '',
      socialUrl: saved?.brand?.socialUrl ?? null,
      showSocial: saved?.brand?.showSocial ?? false,
      currency: currencyLabel(menu.restaurant.currency || d.brand.currency),
    },
    hero: {
      ...d.hero,
      titleLine1: saved?.hero?.titleLine1 ?? venueTitle.line1,
      titleLine2: saved?.hero?.titleLine2 ?? venueTitle.line2,
      description: saved?.hero?.description ?? `Explore food and drinks from ${menu.restaurant.name}.`,
    },
    groups,
    categories,
  };
  delete (config.brand as any).fallbackLogoUrl;
  return MenuConfigSchema.parse(config);
}
