# Paste into Cursor (Agent mode) — "Arena" customer menu (all cafés)

## Goal
Every café's public customer page (`/menu/:id`) uses the Arena design by default and must look and behave like `arena-menu-kit/design/approved-design.html`: animated hero, 3D can, floating food and drinks, bubbles, marquee, stats, sticky category rail, glass panels, EN + AR names. It must show that café's **live** data (categories, items, prices, price options, discounts, logo) — not Urban-only hardcoded lists.

Arena is the default theme for all cafés. A café manager can turn it off (classic fallback) from Menu design. Missing `menu_designs` rows are treated as `enabled: true` with empty settings (deep-merged over defaults).

## What is in `arena-menu-kit/` (already built and tested; do not rewrite)
- `client-src-menu-arena/`: a **ready React module** for this app's stack (Vite + React + wouter), already ported from the approved design and tested inside React under this app's production CSP:
  - `ArenaMenu.tsx`: `<ArenaMenu config={…}/>`. Mounts the design and cleans up fully on unmount (no leftover listeners or bubbles). Background refetches with the same content do not remount it.
  - `arena-engine.ts`: the design's animation engine (logic, timings and easing identical to the approved page).
  - `arena.css`: the design's CSS scoped to `.arena-root` (keyframes prefixed `arena-`) so it cannot leak into the rest of the app.
  - `arena-markup.html`: the design's markup (imported with Vite `?raw`).
  - `config.ts`: Zod schema of the design config. `buildArenaConfig.ts`: turns the `/api/menu/public/:id` payload + saved design settings into that config. `arena-default-design.json`: default texts, colours, images and effects, default visuals for the 16 known categories, and Arabic names for the 70 known items.
- `client-public-assets/arena/`: 57 images. The 4 3D files are downloaded in Step 1.
- `scripts/verify-arena-config.ts`: a data-mapping test in this repo's `verify-*.ts` style.
- `tests/arena-parity.spec.ts`: a Playwright end-to-end test against the production build.
- `design/`: the approved design (`approved-design.html`, visual reference) and its data-driven source (`menu.html`).

## Hard rules
1. **Do not edit** `arena-engine.ts`, `arena.css` or `arena-markup.html`. If something looks wrong, report it with a screenshot; do not "fix" the design. No Tailwind/shadcn rewrite of the customer view.
2. **Do not touch** the classic customer page (`customer-menu.tsx` body, its components and libs), staff/admin features, auth or RBAC, except where a step says so.
3. **Database safety:** first tell me which database `npm run dev` uses (local data, or the cloud Supabase in `.env.cloud`). **Never run a migration or write data against the cloud/production database without my explicit "yes" in chat.**
4. **Security headers:** change the CSP **only** as written in Step 4.5. Keep `server/publicMenuBoundary.ts` as strict as it is.
5. Work on a new git branch `feature/arena-menu`. Commit after each step.
6. `npm test` and `npx tsc --noEmit` must stay green after every step.

Stop after each **PHASE** with the phase report. Do not start the next phase until I say "go".

---

# PHASE 1: Urban Café shows the Arena design (defaults + live data)

### Step 1: Assets
1. Copy `arena-menu-kit/client-public-assets/arena/` → `client/public/assets/arena/`. They are served at `/assets/arena/...`, which the public boundary already allows. Confirm the Cloudflare Worker serves them too.
2. Download the 4 files listed in `client/public/assets/arena/3d/README.txt` into that folder with those exact names. They must be self-hosted because CSP `connect-src` blocks api.getlayers.ai. Then delete the README.
3. Inspect `can.glb` and list its `extensionsUsed` (read the GLB JSON chunk). If it uses `KHR_draco_mesh_compression`, `EXT_meshopt_compression` or `KHR_texture_basisu`, self-host the matching decoder under `/assets/arena/decoders/` and set model-viewer's `dracoDecoderLocation` / `meshoptDecoderLocation` / `ktx2TranscoderLocation` before mount (default locations are on gstatic.com, which CSP blocks). If none are used, do nothing.
4. `npm i gsap @google/model-viewer` (and `zod` if not already a dependency).

### Step 2: Install the module
1. Copy `arena-menu-kit/client-src-menu-arena/*` → `client/src/menu-arena/`.
2. Copy `arena-menu-kit/scripts/verify-arena-config.ts` → `scripts/` and append `&& tsx scripts/verify-arena-config.ts` to the `"test"` script.
3. Check that the tsconfig and Vite config resolve `?raw` imports and JSON imports (Vite client types). Do not change the module to make it compile; adjust config instead and tell me what you changed.

### Step 3: Wire the data helpers
In the place that renders the Arena page (Step 4.3), call `buildArenaConfig(publicMenu, design.settings, helpers)` with helpers wired to this app's **existing** logic (do not re-implement it):
- `isItemVisible(item)`: the exact rule the classic customer page uses for availability and `special_date` (daily specials). Find it in `customer-menu.tsx` or `menuRefresh`/related libs and reuse it.
- `arabicForItem(name)` / `arabicForCategory(title)`: the translations from `client/src/lib/menuLanguage.tsx` (return `''` when none).
- `groupForCategory(category, items)`: from `client/src/lib/menuDiscovery.ts`. Drinks → `'drinks'`; Food, Snacks and Sweets → `'food'`.
Run `npx tsx scripts/verify-arena-config.ts`; it must print PASS.

### Step 4: Per-café switch, storage, routing, CSP
1. **Drizzle:** new table `menu_designs`: `restaurant_id` varchar PK → `restaurants.id` on delete cascade; `enabled` boolean not null default false; `settings` jsonb not null default `'{}'`; `updated_at` timestamp default now(); `updated_by` varchar null. Generate migration `0007_…`. Apply **only to the database you confirmed is local/dev**; ask me before cloud.
2. **Public payload:** add `design: { enabled: boolean, settings: object } | null` to `GET /api/menu/public/:id` in **every** implementation (Express `server/cafeControls.ts` AND the Worker path if separate). Read-only; no new public routes.
3. **Routing:** at the top of `client/src/pages/customer-menu.tsx`, after the payload loads: if `data.design?.enabled !== false` (missing design = on), render `<ArenaMenu config={buildArenaConfig(…)} />` (lazy-load the `menu-arena` chunk with `React.lazy`); else render the existing page unchanged. If `buildArenaConfig` throws (invalid data), log it and fall back to the classic page. Never show a blank page.
4. **Enable script:** `scripts/enable-arena.ts <restaurantId|--all> [on|off]` upserts `menu_designs`. Prefer `--all on` when rolling Arena out to every café (local by default; cloud only with `ALLOW_CLOUD_ARENA=1`).
5. **CSP** (`server/securityHeaders.ts` AND `client/public/_headers`), exactly these two changes and nothing else. Both were proven necessary in testing:
   - `connect-src 'self'` → `connect-src 'self' blob: data:` (three.js loads the can's embedded textures through `blob:` URLs; without this the can renders without its label);
   - `script-src 'self'` → `script-src 'self' 'wasm-unsafe-eval'` (model-viewer compiles a WebAssembly decoder at startup; this allows WebAssembly only, NOT JavaScript `eval`).
   - If Step 1.3 needed a decoder that uses workers, also add `worker-src 'self' blob:`.

### PHASE 1 gate (CSP is off in dev, so test the production build)
- `npm test` (includes PASS from verify-arena-config), `npx tsc --noEmit`, `npm run cloud:test`: all pass.
- `npm i -D @playwright/test && npx playwright install chromium`
- `npm run build && npm start`, then run `npx playwright test arena-menu-kit/tests/arena-parity.spec.ts` with `ARENA_URL=<local-prod>/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7` and `CLASSIC_URL=<local-prod>/menu/4fb514c8-9d8c-441b-a92b-aa2b72bfbede`. All 4 tests pass (no CSP violations, the 3D model actually loads, other cafés unchanged, nothing left behind after navigating away).
- Open `test-results/arena/` (live vs reference, desktop + mobile) and list visual differences. Ignore floater positions (random) and these expected differences: 18 categories / 84 items (live data); "12'' Pizza" and "Desserts" have no banner and a default colour until set in Phase 2.

### PHASE 1 report
```
ARENA PHASE 1 REPORT
Dev database = local | cloud  (migration applied to: …)
GLB extensionsUsed: …  | decoders self-hosted: …
Files added/changed: …
Config changes for ?raw/JSON (if any): …
CSP diff (both files): …
Tests: npm test [ ] tsc [ ] cloud:test [ ] arena-parity 1[ ] 2[ ] 3[ ] 4[ ]
Visual differences: …
Open issues: …
```

---

# PHASE 2: Admin screen "Menu design" (after my "go")
New page `/admin/menu-design` (café manager for their own café; super admin inside a café context) with a sidebar entry in `AppSidebar`. Use the existing admin patterns (shadcn, react-query, the existing photo/logo upload that returns `/objects/<uuid>`).
- **API:** `GET/PUT /api/admin/menu-design`, scoped to the user's café with the same auth middleware as the other café admin endpoints. Zod-validate the body as a *partial* of `arena-default-design.json`'s shape plus `categories: Record<categoryId, {group?, nameAr?, hue?, bannerUrl?, iconUrl?}>`. Allowed image URLs: `/objects/<uuid>`, `/assets/arena/...`, `https://…`. Implement it wherever the admin API lives (Express and the staff Worker if separate). Record changes in `access_audit` if other admin edits do.
- **Store only what the manager changed** (partial overrides). `buildArenaConfig` deep-merges them over the defaults, so future default improvements still apply.
- **Sections** (field names = keys in `arena-default-design.json`):
  1. Arena style on/off + "Open customer menu" + "Reset to defaults" (per section and all)
  2. Branding & SEO: page title, description, logo override (empty = café logo), social label/URL/show, footer text/note
  3. Theme: accent + text-on-accent colours (contrast warning), heading/body/Arabic font (curated lists)
  4. Hero: title lines 1–2, description, button label/icon, badge on/off/icon/title/subtitle (token chips `{items}` `{categories}` `{minPrice}` `{food}` `{drinks}`), side lines 1–2, scroll cue on/off/label
  5. Groups & cards (food, drinks): label, rail label, 3 background colours (gradient swatch), card label, count suffix, card image, can texture
  6. Floating images: 9 slots per group (upload/replace/clear) with a mini map of each slot's position, plus 4 background slots with on/off
  7. 3D & effects: 3D on/off, model `.glb` upload, alt, exposure 0–5, tilt −180…180; bubbles on/off/image/interval; reveal, count-up, tilt and cursor-repel switches
  8. Menu section: marquee on/off, mode (categories/custom) + custom words, separator; intro title / Arabic title / subtitle; stats (label + on/off); labels (ITEMS / items / Sold out / All)
  9. Categories: a table of this café's categories: group (food/drinks), Arabic name, colour, banner, tile icon
- Saving is live (same as the rest of this app): toast, then invalidate the public menu query.

### PHASE 2 gate
- Change the hero title, one category colour + banner, one floater, and switch bubbles off. All show on `/menu/<urban id>` after reload; then revert all.
- Turn Arena off for Urban → classic page; back on → Arena.
- A manager of another café gets 403 on Urban's design API.
- Phase 1 tests still pass on the production build.

---

# PHASE 3: Deploy (only after my "go")
List exactly what will run against the cloud (migration, `enable-arena` for Urban, `deploy:menu`, `deploy:staff`) and wait for my "yes". Then run it and verify the live public menu with `arena-parity.spec.ts` using the live URLs.
