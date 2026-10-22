import { z } from 'zod';

/** Allowed image/model URLs for Arena design overrides. */
export const arenaAssetUrl = z.string().refine(
  (v) =>
    /^\/objects\/[a-f0-9-]{36}$/i.test(v) ||
    /^\/assets\/arena\/[A-Za-z0-9._\-/]+$/.test(v) ||
    /^https:\/\//i.test(v),
  { message: 'Use /objects/<uuid>, /assets/arena/…, or an https URL' },
);
export const arenaAssetUrlOrNull = z.union([arenaAssetUrl, z.null()]);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const optStr = z.string().max(500);
const optLong = z.string().max(2000);

const categoryOverride = z
  .object({
    group: z.enum(['food', 'drinks']).optional(),
    nameAr: z.string().max(200).optional(),
    hue: hex.optional(),
    bannerUrl: arenaAssetUrlOrNull.optional(),
    iconUrl: arenaAssetUrlOrNull.optional(),
  })
  .strict();

const groupOverride = z
  .object({
    key: z.enum(['food', 'drinks']).optional(),
    label: optStr.optional(),
    railLabel: optStr.optional(),
    bg: z.object({ inner: hex.optional(), mid: hex.optional(), outer: hex.optional() }).strict().optional(),
    canTextureUrl: arenaAssetUrlOrNull.optional(),
    card: z
      .object({
        label: optStr.optional(),
        countSuffix: optStr.optional(),
        imageUrl: arenaAssetUrlOrNull.optional(),
        imageAlt: optStr.optional(),
      })
      .strict()
      .optional(),
    floaters: z.array(arenaAssetUrlOrNull).max(9).optional(),
  })
  .strict();

/** Partial Arena design settings (manager overrides only). */
export const menuDesignSettingsSchema = z
  .object({
    version: z.literal(1).optional(),
    seo: z.object({ title: optStr.optional(), description: optLong.optional() }).strict().optional(),
    theme: z
      .object({
        accent: hex.optional(),
        accentInk: hex.optional(),
        fontHeading: optStr.optional(),
        fontBody: optStr.optional(),
        fontArabic: optStr.optional(),
      })
      .strict()
      .optional(),
    brand: z
      .object({
        logoUrl: arenaAssetUrlOrNull.optional(),
        logoAlt: optStr.optional(),
        socialLabel: optStr.optional(),
        socialUrl: z.union([z.string().url().max(500), z.literal(''), z.null()]).optional(),
        showSocial: z.boolean().optional(),
        footerText: optStr.optional(),
        footerNote: optStr.optional(),
        currency: optStr.optional(),
        fallbackLogoUrl: arenaAssetUrlOrNull.optional(),
      })
      .strict()
      .optional(),
    hero: z
      .object({
        titleLine1: optStr.optional(),
        titleLine2: optStr.optional(),
        description: optLong.optional(),
        ctaLabel: optStr.optional(),
        ctaIcon: optStr.optional(),
        showBadge: z.boolean().optional(),
        badgeIcon: optStr.optional(),
        badgeTitle: optStr.optional(),
        badgeSubtitle: optStr.optional(),
        sideLine1: optStr.optional(),
        sideLine2: optStr.optional(),
        showScrollCue: z.boolean().optional(),
        scrollCueLabel: optStr.optional(),
      })
      .strict()
      .optional(),
    groups: z.array(groupOverride).max(2).optional(),
    product3d: z
      .object({
        enabled: z.boolean().optional(),
        modelUrl: arenaAssetUrlOrNull.optional(),
        alt: optStr.optional(),
        exposure: z.number().min(0).max(5).optional(),
        tiltDeg: z.number().min(-180).max(180).optional(),
      })
      .strict()
      .optional(),
    backFloaters: z
      .array(z.object({ imageUrl: arenaAssetUrlOrNull.optional(), enabled: z.boolean().optional() }).strict())
      .max(4)
      .optional(),
    bubbles: z
      .object({
        enabled: z.boolean().optional(),
        imageUrl: arenaAssetUrlOrNull.optional(),
        intervalMs: z.number().int().min(50).max(10000).optional(),
      })
      .strict()
      .optional(),
    marquee: z
      .object({
        enabled: z.boolean().optional(),
        mode: z.enum(['categories', 'custom']).optional(),
        separator: optStr.optional(),
        customItems: z.array(z.string().max(100)).max(40).optional(),
      })
      .strict()
      .optional(),
    menuIntro: z
      .object({ title: optStr.optional(), titleAr: optStr.optional(), subtitle: optLong.optional() })
      .strict()
      .optional(),
    stats: z
      .array(
        z
          .object({
            key: z.enum(['items', 'categories', 'minPrice']).optional(),
            label: optStr.optional(),
            enabled: z.boolean().optional(),
          })
          .strict(),
      )
      .max(3)
      .optional(),
    filters: z.object({ allLabel: optStr.optional(), showGroupFilter: z.boolean().optional() }).strict().optional(),
    labels: z
      .object({ itemsUpper: optStr.optional(), itemsLower: optStr.optional(), soldOut: optStr.optional() })
      .strict()
      .optional(),
    effects: z
      .object({
        reveal: z.boolean().optional(),
        countUp: z.boolean().optional(),
        tilt: z.boolean().optional(),
        cursorRepel: z.boolean().optional(),
      })
      .strict()
      .optional(),
    /** Per-category visual overrides keyed by category UUID. */
    categories: z.record(z.string().uuid(), categoryOverride).optional(),
  })
  .strict();

export const menuDesignPutSchema = z
  .object({
    enabled: z.boolean().optional(),
    settings: menuDesignSettingsSchema.optional(),
  })
  .strict()
  .refine((b) => b.enabled !== undefined || b.settings !== undefined, {
    message: 'Provide enabled and/or settings',
  });

export type MenuDesignSettings = z.infer<typeof menuDesignSettingsSchema>;
