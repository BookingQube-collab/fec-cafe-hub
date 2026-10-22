# Café deployment and recovery

## Current system

- Private source: https://github.com/malikamaan12/cafe-menu (`main`).
- Public menus: https://menu.cafe-menu.workers.dev.
- Staff login: https://staff.cafe-menu.workers.dev/login.
- Urban: `/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7`.
- Inflata: `/menu/4fb514c8-9d8c-441b-a92b-aa2b72bfbede`.
- Drive Through: `/menu/a3fc34fa-ce03-4cda-8cc9-4020ee55f9b1`.

Use only the dedicated **Cafe Menu** Cloudflare account
`69e2ef22efdd52ebbc1aefc3d8aa8980`. Public Worker `menu` uses `wrangler.jsonc`;
management Worker `staff` uses `wrangler.staff.jsonc`. Preview URLs are disabled.
Hyperdrive `2c0378c020ab47479092cbc19fa3c95e` connects to Supabase project
`kfxdazzbnbbhzbkplpqf`. Keep Hyperdrive query caching disabled for fresh menu,
role and account-revocation checks. The retired Health Companion café URLs must
not be restored. Each real café retains one permanent menu ID and QR.

Use the live dashboard for live changes. Local PGlite is an independent copy.
Automatic deployment is being configured through Cloudflare Workers Builds.
Both Workers use `malikamaan12/cafe-menu`, branch `main`, and the repository root.
Build command: `npm ci --include=dev && npm run ci:build`.
Deploy command for `menu`: `npm run deploy:menu`.
Deploy command for `staff`: `npm run deploy:staff`.
Use Node 22 through `.nvmrc`; keep non-production branch/preview builds disabled.
The shared build gate must pass before either Worker is deployed. It runs type,
unit, photo, setup, artifact, isolated Worker and Node-production checks. Builds
do not migrate or seed production data. Database/session/photo/password secrets
are runtime-only and must not be copied into build settings or GitHub. Existing cloud secrets
remain in Workers and the private Supabase password function; do not resend
them for routine releases. Never commit environments, credentials, databases,
snapshots, sessions, logs or CLI caches. Templates contain no real secrets.

The public Worker enforces its allowlist before SPA fallback and blocks staff
login/admin/mutation routes. Staff cookies are secure, HttpOnly and host-only;
role/tenant checks protect private APIs. Supabase tables are not exposed to
anonymous clients. The private `cafe-media` bucket is accessed through the backend
with ownership checks. Billing and public registration are disabled.

## Verify and publish

`npm run ci:build` runs the complete pre-deployment gate. It prepares ignored
scratch report directories and is portable to a clean checkout without `.env.cloud`.
Cloudflare manages the repository integration and deployment authentication;
do not create a second GitHub Actions deployment workflow alongside Workers Builds.
The dashboard build results identify the commit deployed to each Worker. A failed
build leaves that Worker's previous deployed version active. Deployments are
independent, so check both build results after a push. For a release requiring
additive migrations, apply them separately before pushing dependent code.

```powershell
npm ci
npm run check
npm run build
npm test
node scripts/verify-artifact-hardening.mjs
npm run cloud:build
npm run cloud:test
node scripts/verify-production-runtime.mjs
```

The integration suite uses a fresh isolated database and mocked photo/password
services. It covers account lifecycle, role/tenant isolation, media ownership,
QR restrictions, modifiers, hidden items and independent library imports.
The Node production smoke test uses a disposable database on port 5101.

After confirming the selected Cloudflare account, deploy staff before public.
These routine commands preserve existing secrets and café data:

```powershell
$env:WRANGLER_SEND_METRICS='false'
npx wrangler whoami
npx wrangler deploy --config wrangler.staff.jsonc
npx wrangler deploy --config wrangler.jsonc
node scripts/verify-compact-popup-release.mjs <PUBLIC_VERSION> <STAFF_VERSION>
node --import tsx scripts/audit-live-guest-menu.ts
```

Use the actual version IDs printed by deployment. Apply additive schema changes
with `node scripts/migrate-cloud-schema.mjs` only when new code requires them;
retain the full migration history. Initial import helpers are for fresh dedicated
databases and refuse populated targets. They are not routine release commands.

Public menu/photo routes use lightweight Worker handlers to reduce CPU work.
Cloudflare Free imposes runtime limits; review errors and CPU before a larger
rollout. Menu data is not cached between requests. Hashed assets/photos may be
cached; HTML, private responses and APIs use no-store. Open guest menus refresh
periodically. Content edits do not change QR destinations.

## Recovery and cleanup

`node scripts/backup-cloud.mjs` creates a private repeatable-read database export
and downloads registered photo bytes with hashes. `data/latest-cloud-backup.json`
points to the latest completed recovery copy. Keep a recent backup before schema
changes or deletion. Cloud backups contain password hashes and sessions and
must never be published. Recover by recreating the saved schema, restoring rows
in dependency order, restoring photo bytes and ownership, and configuring private
runtime secrets. Start with fresh sessions after recovery.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-local.ps1`
stops only the recorded café process, copies database/uploads/environment and
matching source, then restarts it if it was running. Read its `RESTORE.txt` before
local restoration. Local backups cannot be copied directly into live Postgres.

The October 14 cleanup removed four QA-only library templates from each of the
live and local databases, unreachable components, unused dependencies, temporary
previews and duplicate working files. Accounts, cafés, 70 Urban items, modifiers,
QR destinations, photos and 70 real global templates were preserved. Recent
complete recovery copies and final presentation deliverables are retained.
Fresh local setup creates only the platform administrator; create real cafés
through the super-admin dashboard. Historical billing columns remain for schema
compatibility, with no active payment workflow.
