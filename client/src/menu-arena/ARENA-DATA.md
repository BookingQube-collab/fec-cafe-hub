# Arena menu: live data vs decorative defaults

## How Arena is enabled

- **Default on for every café.** `GET /api/menu/public/:id` returns `design.enabled: true` when there is no `menu_designs` row (or the row has `enabled: true`).
- **Classic menu** only when `menu_designs.enabled` is explicitly `false`.
- **Admin toggle:** Café manager → **Menu design** → “Arena style on/off”. Saving creates/updates the row.
- **Scripts:**
  - `npx tsx scripts/enable-arena.ts <restaurantId> [on|off]` — one café
  - `npx tsx scripts/enable-arena-all.ts [on|off]` — every café that has menu categories
  - Cloud writes require `ALLOW_CLOUD_ARENA=1` (uses `.env.cloud`)
- New DB rows default `enabled=true` (migration `0008_arena_enabled_default`).

## Live from `/api/menu/public/:id`

| Surface | Source |
| --- | --- |
| Venue name | `restaurant.name` |
| Logo | `restaurant.logoUrl` (unless admin sets a logo override) |
| Currency | `restaurant.currency` |
| Category titles / order | `categories[]` |
| Item names, prices, discounts, multi-price | `items[]` + `variants[]` |
| Availability | `items[].isAvailable` (same rule as classic) |
| Category rail icons | First item `imageUrl` when present; else title-matched chrome |
| Hero floaters / group cards | Item `imageUrl`s by food/drinks group when present |
| Default hero / SEO (if not overridden) | Derived from `restaurant.name` |

Arabic labels prefer `menuLanguage` helpers; `itemArabicByName` / category title chrome are last-resort fallbacks for known Urban names.

## Decorative / default-only (not menu content)

From `arena-default-design.json` + optional admin overrides:

- Theme colours and fonts
- Hero CTA / badge / side lines / scroll cue (unless overridden)
- 3D can, bubbles, back floaters, marquee, stats, labels, effects
- Group layout chrome (rail labels, background gradients, can textures)
- **Hardcoded floaters / card art** — used only when the café has no item photos (or the manager uploaded custom floaters)
- **`categoryVisualsByTitle`** — hue + banner (+ icon if no item photo) for titles that match the Urban pack (e.g. “Pizza”)
- Urban pack images under `/assets/arena/…`

Managers customize chrome in **Menu design**; only changed fields are stored. Menu items and prices are never taken from the defaults JSON.
