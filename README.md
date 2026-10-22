# Café menu application

The application has independent café themes, café-manager and super-admin roles, a reusable global menu library, and a premium phone-friendly guest menu. See [the detailed audit](AUDIT.md), [the permission model](RBAC.md), and [Workers + Supabase publishing setup](DEPLOYMENT.md).

Published free-plan pilot: [Urban Café menu](https://menu.cafe-menu.workers.dev/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7) · [Management login](https://staff.cafe-menu.workers.dev/login). Public QR menus and staff administration run on separate origins in the dedicated Cafe Menu Cloudflare account.
Use the published dashboard for live edits. Existing account credentials still work.
Download each café's permanent QR from its live staff dashboard. Read the measured CPU
limitations and manual cloud-backup procedure in DEPLOYMENT.md before a busy rollout.

## Run locally

Source repository: `https://github.com/malikamaan12/cafe-menu` (private).
Clone with `git clone https://github.com/malikamaan12/cafe-menu.git`.
The repository contains application source, migrations and optimized food images;
live café data, local databases, credentials, backups and generated review files remain private.
Copy `.env.example` for a fresh local setup. Existing cloud secrets stay in Cloudflare/Supabase;
GitHub deployment uses Cloudflare Workers Builds with a shared pre-deployment gate;
see DEPLOYMENT.md for both Worker build settings. Live café URLs stay permanent.
Before each source push, stage the changes and run `node scripts/verify-source-control.mjs`.

Double-click `START-CAFE.cmd`. It checks dependencies/setup/build, starts the server hidden, waits for readiness, and opens login. Node.js 22.12 or newer is required. The existing application runs at http://localhost:5100.

Alternatively, from this directory:

```powershell
npm ci
npm run setup
npm run build
npm start
```

Setup preserves existing accounts, passwords and data. Run only one server process per database directory. For source changes, run `npm run check`, `npm run build`, then `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restart-local.ps1`. The restart helper verifies the recorded process before stopping it; optional `-Backup` copies the stopped database and migrations.

## Existing cafés and accounts

- Urban Café: 70 items, 16 categories, four price options, 70 studio images, plum theme, QAR and Asia/Qatar. Manager: `manager@urban.cafe`; password is stored privately in `URBAN-CAFE-CREDENTIALS.txt`.
- Inflata Café: its own menu and permanent QR. Manager: `manager@inflata.cafe`.
- Drive Through Café: its own menu and permanent QR. Manager: `manager@drivethrough.cafe`. These managers' credentials are in the private `NEW-CAFE-CREDENTIALS.txt`.
- Super admin: `platform@cafe.local`. Its password is in the private `SETUP-CREDENTIALS.txt`. The empty E3 café setup was retired.

Open http://localhost:5100/admin for the café dashboard. Urban's customer menu is http://localhost:5100/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7. Password changes are under Account & Backup or My Account. Keep credential files private.

## Café workflow

1. **Profile & Theme:** draft café details, logo/cover, currency and timezone; preview one of five independent palettes. Save café publishes the draft. Discard changes restores saved values; following a different page link warns about unpublished edits. Currency labels change without converting prices.
2. **Categories:** create, rename and reorder; see counts. Blank/duplicate names are rejected. Deleting a category removes its items and options after confirmation.
3. **Menu Items:** browse the complete grouped menu; search/filter; add/edit/remove photos, descriptions, tags, availability, discounts and today's specials. Choose single pricing or up to three unique size/price options. Under **Toppings & custom choices**, add up to eight groups with up to twenty choices each. Set single/multiple selection, required/minimum/maximum counts, availability, Arabic labels, and included (0) or paid extras. Item/options save atomically; stale editor revisions are rejected.
4. **Specials:** use Today or a date. The guest badge/filter applies in that café's timezone; the dish remains in the regular menu after the date expires.
5. **Global Menu Library:** save reusable items, then import selected templates into an authorized café. Copies have their own photos/prices/topping groups, start hidden for review and omit inherited discounts/specials. Currency differences require acknowledgement; prices are not converted. Repeated imports skip duplicates.
6. **QR Code:** copy the permanent menu link or download PNG/SVG. Each café keeps one QR destination across menu/profile/theme edits. The guest origin blocks staff pages, login and management APIs. Localhost QR codes are unsuitable for guests. Open, active menus refresh approximately every five seconds.
7. **Account & Backup:** change password, export menu JSON, or clear the café menu by typing CLEAR MENU and confirming. Clearing retains the café profile/account.

A super admin creates cafés/managers; public registration and billing are disabled for internal operation. A manager controls its own café. Super admins add, edit, freeze/unfreeze and delete/restore accounts, manage café visibility/suspensions, and use Open café account to enter any café's workspace without changing identity. The workspace banner identifies both café and actor; Return to platform clears the selection.

## Guest experience

A compact search bar and one Filters dialog expose Food, Snacks, Drinks and Sweets, detailed categories, today's specials and saved items. Color, CSS/GSAP motion, photos and glass item details adapt to each café's theme. Guests can select price options, save favorites in their browser, and use Can't decide? to spin a wheel over the filtered menu. Motion can be paused and respects device reduced-motion preferences. Configured cover video pauses when motion is disabled or the page is hidden.

Guests can switch between English and Arabic. Item details show configured variants, sauces, toppings and extras, enforce selection limits, and calculate an estimated total. Item/size discounts apply to the base price; extras use their listed prices. Unavailable choices cannot be selected, and removed/unavailable selections are reconciled when menu data refreshes. Existing items start with no topping groups; managers configure the café's actual offerings.

Favorites, the wheel and customization are for browsing/reference and do not place orders. Guests tell the café team their selections and ask about ingredients/allergens.

## Urban source and photos

The supplied QR poster linked to an eight-page source menu saved at `test-data/urban-menu-source.pdf`. English-page prices were used where Arabic prices differ; see `test-data/URBAN-IMPORT-NOTES.md`. All 70 original names/prices and existing café/item IDs are retained.

`fixtures/urban-menu.json` is the versioned reusable import/test source. With an existing Urban manager and the local server running, `node scripts/import-urban-menu.mjs` verifies an existing import or populates its empty menu; it does not create public accounts or erase an existing menu.

Studio photos were generated from the menu/reference brief. Their assets and manifest are in `assets/urban-menu-photos/`. The 70 canonical 1024×1024 WebP images total approximately 7 MB; duplicate PNG working originals were removed. The café should review food representation before public use.

## Persistence and public launch

Database and sessions persist in `data/database`; photos persist in `data/uploads`. Keep `.env`, credentials and `data/` private and outside source control. A complete restorable backup requires stopping the server and copying the full `data/` directory plus `.env`. Menu JSON excludes photo bytes and has no restore/import interface.

Local setup is not public hosting. Before guest launch use a stable reachable address, HTTPS, `COOKIE_SECURE=true`, and guest QR codes generated at that address. Set `TRUST_PROXY=true` only for the intended trusted reverse proxy. Embedded storage supports one process, not distributed instances.

Production dependency audit reports zero vulnerabilities. The full build-tool dependency tree retains 7 high findings from an unpatched braces chain; see the primary advisory and containment details in [AUDIT.md](AUDIT.md). Production no longer imports Vite/build tooling. TypeScript/build pass; one upstream PostCSS missing-from warning remains.

## Verification

Use these isolated checks, which do not mutate live cafés or require real manager accounts:

```powershell
npm run check
npm run build
npm test
node scripts/verify-production-runtime.mjs
npm run cloud:build
npm run cloud:test
```

The production smoke test uses port 5101 and a disposable database, never the live database. TypeScript rejects unused locals and parameters. One-off tests that depended on the retired E3 account have been replaced by the isolated Worker integration suite. Fresh setup creates only the platform administrator; add real café accounts through the dashboard.

For current Cloudflare integration coverage, build the Worker with `npm run cloud:build` then run `npm run cloud:test`. This uses an isolated database and mock storage, never live café data, and covers modifier saves/public visibility, validation rollback, tenant isolation, independent library copies, backup, and the existing security/account workflows. `scripts/preview-menu-modifiers.ts` creates a separate disposable demo at port 5102 for UI testing; its synthetic wrap/toppings are never added to production. Deploy additive migration `0006_lame_bedlam` before publishing code that selects the modifier columns; `scripts/migrate-menu-modifiers.mjs` preserves existing menus/accounts/security and applies only schema migrations, not data seeding.

