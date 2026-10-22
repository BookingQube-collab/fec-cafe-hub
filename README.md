# Café menu application

Independent café themes, café-manager and super-admin roles, a reusable global menu library, and a phone-friendly guest menu. See [the detailed audit](AUDIT.md), [the permission model](RBAC.md), and [Node + Supabase deployment](DEPLOYMENT.md).

**Stack:** Node.js / Express + Supabase (Postgres + Storage). Cloudflare Workers are not part of this project.

## Run locally

Source: https://github.com/BookingQube-collab/fec-cafe-hub

```powershell
npm ci
npm run setup
npm run build
npm start
```

Or `npm run dev` for the TypeScript server with Vite. Node.js 22.12+ is required. Default app URL: http://localhost:5100

Copy `.env.example` for a fresh local PGlite setup. To use Supabase instead of embedded PGlite, copy `.env.cloud.example` → `.env.cloud` and set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET` (`npm run db:configure` scaffolds the file). `server/db.ts` loads `.env` then fills missing keys from `.env.cloud`.

Before each source push, stage changes and run `node scripts/verify-source-control.mjs`.

## Existing cafés and accounts

- Urban Café: Manager `manager@urban.cafe` (credentials stay in private files, never in git).
- Inflata Café: Manager `manager@inflata.cafe`.
- Drive Through Café: Manager `manager@drivethrough.cafe`.
- Super admin: `platform@cafe.local`.

Open http://localhost:5100/admin for the café dashboard. Urban’s customer menu: http://localhost:5100/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7

## Café workflow

1. **Profile & Theme** — draft café details, logo/cover, currency and timezone; save café to publish.
2. **Categories** — create, rename, reorder; deleting removes items after confirmation.
3. **Menu Items** — photos, descriptions, tags, availability, discounts, specials, size options, toppings.
4. **Specials** — date-scoped in the café timezone.
5. **Global Menu Library** — save reusable templates; import copies into a café for review.
6. **QR Code** — permanent `/menu/:restaurantId` link. Set `PUBLIC_URL` in production so printed codes use the live origin, not localhost.
7. **Account & Backup** — password change, menu JSON export, clear menu with confirmation.

A super admin creates cafés/managers; public registration and billing are disabled. Managers control their café; super admins can open any café workspace.

## Guest experience

Search and filters, theme-aware presentation, English/Arabic, price options and toppings. Favorites and the decision wheel are browse-only (no orders).

## Persistence

Without `DATABASE_URL`: database/sessions in `data/database`, photos in `data/uploads`. With Supabase: Postgres via `DATABASE_URL`, media via service-role Storage. Keep `.env` / `.env.cloud`, credentials, and `data/` private.

## Verification

```powershell
npm run check
npm run build
npm test
node scripts/verify-production-runtime.mjs
```
