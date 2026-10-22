# Café deployment and recovery

## Current system

- Source: https://github.com/BookingQube-collab/fec-cafe-hub (`main`).
- Runtime: **Vercel serverless** (Express via `api/index.ts`) + **Supabase** Postgres and Storage.
- Local development still uses long-running Express (`npm run dev` / `npm start`).
- Cloudflare Workers and Railway are not used.

Café permanent menu IDs:

- Urban: `/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7`
- Inflata: `/menu/4fb514c8-9d8c-441b-a92b-aa2b72bfbede`
- Drive Through: `/menu/a3fc34fa-ce03-4cda-8cc9-4020ee55f9b1`

Use the live dashboard for live changes. Local PGlite (no `DATABASE_URL`) is an independent copy and is **not** available on Vercel.

## Environment

Copy `.env.cloud.example` to private `.env.cloud` (or use `.env`). Required for Supabase / Vercel:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string (**required on Vercel**) |
| `SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for private Storage |
| `SESSION_SECRET` | Express session signing (≥ 48 chars) |
| `STORAGE_BUCKET` | Defaults to `cafe-media` (private bucket) |
| `PUBLIC_URL` | Absolute HTTPS origin for printed QR codes (your Vercel URL) |
| `COOKIE_SECURE` | Set `true` in production HTTPS (auto-`true` on Vercel if unset) |
| `TRUST_PROXY` | Set `true` behind Vercel (auto-`true` on Vercel if unset) |

Passwords use **bcryptjs** (pure JS; compatible with existing bcrypt hashes). Do not deploy or call the removed `cafe-passwords` edge function.

Generate a private env file skeleton:

```powershell
npm run db:configure
```

Apply migrations before or on first cloud boot (the serverless function also runs idempotent Drizzle migrate when `migrations/` is present):

```powershell
npm run db:migrate
```

Never commit `.env`, `.env.cloud`, credentials, `data/`, or `backup/`.

## Hosting on Vercel (recommended)

The SPA builds to `dist/public`. API and media upload routes run as one Node serverless function exporting Express (`api/index.ts`). `vercel.json` rewrites `/api/*` and `/objects/*` to that function and falls back to `index.html` for client routes.

### Dashboard settings

In the Vercel project → **Settings → General / Build & Development Settings**:

1. **Framework Preset:** Other (not Next.js).
2. **Build Command:** `npm run build` (from `vercel.json`; leave blank to use the file).
3. **Output Directory:** `dist/public` — **not** `dist`, **not** `.`.
4. **Install Command:** `npm ci`.
5. **Root Directory:** repository root (empty / `.`).
6. **Node.js Version:** 22.x.
7. Do **not** set a “Start command” for `node dist/index.js` — Vercel does not run a persistent Node process.

`vercel.json` already sets framework `null`, build/output/install, function memory/duration, and rewrites. Prefer the repo file over conflicting dashboard overrides.

### Environment variables (Production + Preview)

Set all of:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` (≥ 48 characters)
- `STORAGE_BUCKET` = `cafe-media` (if not defaulting)
- `PUBLIC_URL` = `https://YOUR_PROJECT.vercel.app` (or custom domain)
- `COOKIE_SECURE` = `true` (optional; defaults on when `VERCEL=1`)
- `TRUST_PROXY` = `true` (optional; defaults on when `VERCEL=1`)
- `NODE_ENV` = `production` (usually set by Vercel)

Redeploy after changing env vars.

### What the rewrites do

| Incoming | Destination |
| --- | --- |
| `/api/*` | Serverless Express (`api/index.ts`) |
| `/objects/*` | Same function (signed media PUT/GET) |
| Other unmatched paths | `index.html` (SPA); existing files under `dist/public` are served first |

### Optional long-running Node (same codebase)

`npm run build` + `npm start` still works on any Node host for local or alternative hosting. Prefer Vercel + Supabase for this project’s production path.

## Verify and run

```powershell
npm ci
npm run check
npm run build
npm test
node scripts/verify-artifact-hardening.mjs
node scripts/verify-production-runtime.mjs
npm start
```

Or for development: `npm run setup` then `npm run dev` (default port from `PORT`, usually `5100`).

Production on Vercel: HTTPS cookies and trust-proxy default on. Point `PUBLIC_URL` at the public HTTPS origin before printing guest QR codes.

## Limitations on serverless

- **Cold starts:** First request after idle can be slow (Express + DB migrate/check + pool).
- **In-memory rate limits:** Login/upload buckets are per-instance; they reset on cold start and do not share across regions.
- **Uploads:** Body size and function duration limits apply; very large images may need smaller files or a future direct-to-Storage upload.
- **No PGlite / local disk:** Vercel requires `DATABASE_URL` and Supabase Storage for media.
- **Connection churn:** Pool size is `1` on Vercel to protect Supabase connection limits.

## Recovery

`node scripts/backup-cloud.mjs` creates a private database export and downloads registered photo bytes when Supabase env vars are configured. Keep backups offline; they contain password hashes and sessions.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-local.ps1` copies local `data/` and env for PGlite setups. Local backups cannot be copied directly into live Postgres.
