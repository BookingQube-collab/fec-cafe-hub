// Shape of the config the page template reads. Mirrors public.build_menu_config() exactly.
// Validated in tests against seed/menu-config.json and the live database output.
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const url = z.string().min(1);                 // absolute URL or /seed/... path
const optUrl = url.nullable();

export const MenuItemSchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string(),
  price: z.number().nonnegative().nullable(),
  priceText: z.string().nullable(),
  tag: z.string().nullable(),
  soldOut: z.boolean(),
}).refine((i) => i.price !== null || (i.priceText ?? '').trim() !== '', { message: 'Item needs a price or price text' });

export const CategorySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  group: z.string(),
  nameEn: z.string().min(1),
  nameAr: z.string(),
  hue: hex,
  bannerUrl: optUrl,
  iconUrl: optUrl,
  items: z.array(MenuItemSchema).min(1),
});

export const GroupSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  railLabel: z.string(),
  bg: z.object({ inner: hex, mid: hex, outer: hex }),
  canTextureUrl: optUrl,
  card: z.object({ label: z.string(), countSuffix: z.string(), imageUrl: optUrl, imageAlt: z.string() }),
  floaters: z.array(optUrl).length(9),
});

export const MenuConfigSchema = z.object({
  version: z.literal(1),
  venue: z.object({ slug: z.string(), name: z.string() }),
  seo: z.object({ title: z.string(), description: z.string() }),
  theme: z.object({ accent: hex, accentInk: hex, fontHeading: z.string(), fontBody: z.string(), fontArabic: z.string() }),
  brand: z.object({
    logoUrl: optUrl, logoAlt: z.string(), socialLabel: z.string(), socialUrl: z.string().nullable(),
    showSocial: z.boolean(), footerText: z.string(), footerNote: z.string(), currency: z.string(),
  }),
  hero: z.object({
    titleLine1: z.string(), titleLine2: z.string(), description: z.string(),
    ctaLabel: z.string(), ctaIcon: z.string(),
    showBadge: z.boolean(), badgeIcon: z.string(), badgeTitle: z.string(), badgeSubtitle: z.string(),
    sideLine1: z.string(), sideLine2: z.string(), showScrollCue: z.boolean(), scrollCueLabel: z.string(),
  }),
  groups: z.array(GroupSchema).length(2),
  product3d: z.object({ enabled: z.boolean(), modelUrl: optUrl, alt: z.string(), exposure: z.number(), tiltDeg: z.number() }),
  backFloaters: z.array(z.object({ imageUrl: optUrl, enabled: z.boolean() })).length(4),
  bubbles: z.object({ enabled: z.boolean(), imageUrl: optUrl, intervalMs: z.number().int() }),
  marquee: z.object({ enabled: z.boolean(), mode: z.enum(['categories', 'custom']), separator: z.string(), customItems: z.array(z.string()) }),
  menuIntro: z.object({ title: z.string(), titleAr: z.string(), subtitle: z.string() }),
  stats: z.array(z.object({ key: z.enum(['items', 'categories', 'minPrice']), label: z.string(), enabled: z.boolean() })),
  filters: z.object({ allLabel: z.string(), showGroupFilter: z.boolean() }),
  labels: z.object({ itemsUpper: z.string(), itemsLower: z.string(), soldOut: z.string() }),
  effects: z.object({ reveal: z.boolean(), countUp: z.boolean(), tilt: z.boolean(), cursorRepel: z.boolean() }),
  categories: z.array(CategorySchema),
});

export type MenuConfig = z.infer<typeof MenuConfigSchema>;
export type MenuCategory = z.infer<typeof CategorySchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
