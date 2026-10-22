# Café deployment and recovery

## Current system

- Source: https://github.com/BookingQube-collab/fec-cafe-hub (`main`).
- Runtime: **Node.js + Express** with **Supabase** Postgres and Storage.
- Cloudflare Workers, Wrangler, Hyperdrive, and the `cafe-passwords` edge function are not used.

Run one Node process that serves staff admin and guest menus on the same host (or set `PUBLIC_URL` / `MANAGEMENT_ORIGIN` if you terminate TLS on separate hostnames that proxy to the same app).

Café permanent menu IDs:

- Urban: `/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7`
- Inflata: `/menu/4fb514c8-9d8c-441b-a92b-aa2b72bfbede`
- Drive Through: `/menu/a3fc34fa-ce03-4cda-8cc9-4020ee55f9b1`

Use the live dashboard for live changes. Local PGlite (no `DATABASE_URL`) is an independent copy.

## Environment

Copy `.env.cloud.example` to private `.env.cloud` (or use `.env`). Required for Supabase:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string |
| `SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for private Storage |
| `SESSION_SECRET` | Express session signing (≥ 48 chars) |
| `STORAGE_BUCKET` | Defaults to `cafe-media` (private bucket) |
| `PUBLIC_URL` | Optional absolute origin for printed QR codes |

Passwords use **native bcrypt in Node**. Do not deploy or call the removed `cafe-passwords` edge function.

Generate a private env file skeleton:

```powershell
npm run db:configure
```

Apply migrations / seed helpers only against a dedicated project when documented by those scripts:

```powershell
npm run db:migrate
```

Never commit `.env`, `.env.cloud`, credentials, `data/`, or `backup/`.

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

Production: set `NODE_ENV=production`, `COOKIE_SECURE=true` behind HTTPS, and `TRUST_PROXY=true` only when behind a trusted reverse proxy. Point `PUBLIC_URL` at the public HTTPS origin before printing guest QR codes.

## Recovery

`node scripts/backup-cloud.mjs` creates a private database export and downloads registered photo bytes when Supabase env vars are configured. Keep backups offline; they contain password hashes and sessions.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-local.ps1` copies local `data/` and env for PGlite setups. Local backups cannot be copied directly into live Postgres.
