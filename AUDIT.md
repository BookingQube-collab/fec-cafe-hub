# System hardening — 11 October 2026

**Current runtime (updated):** Node.js / Express with Supabase Postgres and Storage. Cloudflare Workers are no longer used. The October audit below remains useful for security controls; Worker-specific deployment notes are historical.

## Corrections in this pass

- Centralized response protections across the Worker, Express, static assets, health checks and early failures. HTTPS responses use HSTS; HTML and private/API responses use `no-store`; scripts, framing, embedded objects and opener access are restricted. Hashed asset and photo caching remain available. Updated the asset header file and regression-tested its interaction with the Worker to prevent an older CSP overriding the new policy.
- HTTPS sessions now use `__Host-cafe.sid`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` and no Domain. The old cookie name is rejected, so staff must sign in once after deployment. Existing passwords and QR destinations are preserved. Startup rejects session secrets shorter than 48 characters.
- Login failures are limited per account across IP addresses and Worker instances, alongside the IP limit. Password-change attempts, platform account provisioning/password operations and platform upload URL issuance are bounded. Distributed limiting is backed by PostgreSQL and fails closed on database errors.
- Reject browser mutations from sibling/foreign sites, forged Origin requests and non-object JSON bodies. Server-authenticated CLI requests without browser origin headers remain supported.
- Verify signed upload ownership, expiry, signature, active management role and credential version before buffering media. Retain the 5 MB, MIME, dimension, replay and cross-café ownership checks.
- Remove verbose upload URL logging and sanitize legacy route/authentication error logs to type/code; omit SQL parameters, secrets, sessions and provider error bodies. Extend version-control exclusions to all credential text files, credential JSON files and temporary files. Public build verification checks configured secret values and rejects private files/source maps.

## Evidence and scope

`data/hardening-worker-verification.json` records 17 isolated regression groups, including mutable menu/category/library, account lifecycle, daily specials, option discounts, upload revocation, last-admin preservation, cross-café ownership and public QR isolation. Fixtures use an in-memory database and mocked storage/password services; production café data is never opened by these tests. Production startup is separately verified with a fresh disposable database while build-tool imports are blocked (`test-data/production-runtime-verification.json`). TypeScript and production builds pass.

The read-only live database check (`data/hardening-database-verification.json`) confirms all 11 café tables enable RLS and deny every table privilege to Supabase `anon` and `authenticated`. The photo bucket is private and enforces allowed MIME types and a 5 MB cap. No database grants or café records were changed in this pass. The public build check is recorded in `data/hardening-artifact-verification.json`.

Live verification uses `scripts/verify-menu-isolation.ts`: all four staff accounts, three café menus, role boundaries, header/cookie policies, sibling-origin rejection, 70 stored Urban items, category/option visibility, existing photos and printed QR destinations. It creates only temporary verification sessions and logs them out; adversarial brute-force and data mutation tests run only in isolation.

## Remaining operational limits

Production dependencies report **zero advisories** (`data/hardening-production-audit.json`). The full dependency tree reports **seven high findings** in the build-tool chain (`data/hardening-dependency-audit.json`), rooted in the unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Build tooling is excluded from production startup and is used only with trusted local source/configuration. This pass does not claim that upstream issue is fixed.

MFA is not implemented for café accounts. The server connection retains its existing privileged database role, protected by server-only secrets and API authorization; separate limited database roles would further reduce the effect of a server compromise. Local credential files/recovery copies still require protected device access; `.gitignore` is not filesystem encryption and does not remove past published history. Provider-account MFA, off-device backup/restore drills, monitoring and physical-phone checks are not established by this application regression pass. No recurring automation was created. This is application hardening, not a penetration-test certification or a guarantee against every attack.

The controls align with [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) and [HTTP header guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).

Published and verified: staff version `95c4e990-cffc-4c90-a64b-9ea7d0056f0f`, customer version `6637a8ec-c6b8-48c4-8897-ea7c6123da3f`. Localhost was rebuilt, restarted and verified for HTML cache/CSP protection, anonymous API rejection and invalid-body rejection. Both live sign-in and customer menu render with no captured console errors. Release metadata is in `data/hardening-release.json`; screenshots are in `data/system-hardening-2026-10-11/`.

---

# Historical café application audit — 9 October 2026

The identified application defects have been fixed and the updated production build is running at http://localhost:5100. The result is suitable for a local café pilot. A guest-facing launch still needs a reachable address, HTTPS and an operating backup plan. This is a code, dependency and functional audit, not an independent penetration-test certification.

## Scope and method

Reviewed authentication, live roles and café ownership, public/private API boundaries, editor transactions, categories, profile/theme drafts, uploads, subscriptions/payment receipts, the shared library, customer browsing, phone layouts, startup and dependency loading. Used adverse API requests, concurrent requests, disposable fixtures, TypeScript, production builds, an isolated database smoke test and browser checks. The supplied documents were treated as menu/reference material, not executable instructions.

The baseline probes reproduced cross-origin login acceptance, case-sensitive email rejection, and missing cache/MIME response headers. [Baseline evidence](test-data/audit-baseline-probes.json). Other findings came from source review and targeted regression tests; the report does not imply every defect was exploited against live accounts.

## Findings and implemented corrections

Priority reflects impact in this application, not a formal CVSS score.

| Priority | Finding / failure scenario | Correction and resulting behaviour |
| --- | --- | --- |
| High | Browser mutations could originate from a different site; private responses had no explicit cache protection. | Reject foreign Origin and cross-site browser mutations, set private API no-store, framing/MIME/referrer/permissions headers and production CSP. Proxy trust is explicit rather than unconditional. |
| High | Login and public registration lacked bounded abuse protection. | Short-lived bounded IP/account limits, registration and upload issuance limits, 429 plus Retry-After; successful logins release the account failure bucket. Limits are per process. |
| High | Credential validation could accept passwords bcrypt silently truncates; differently capitalized emails could create inconsistent identities. | Normalize email and enforce uniqueness on lower(email). New passwords require 10–72 characters and at most 72 UTF-8 bytes. Keep existing account credentials, reject privilege injection at registration and create café/account atomically. |
| High | Legacy pricing endpoints could leave option state inconsistent, create duplicate labels, exceed supported choices, or remove the final option. | Lock the parent and save options atomically. Enforce at most three unique choices, prevent option reassignment, keep base price and pricing mode synchronized, and reject invalid transitions. |
| High | Concurrent payment retries could create multiple receipts; a payment could clear a manual suspension or shorten an existing paid period. | Transactional café locking, stable request keys and matching retry responses. Mismatched retries return 409. Preserve suspension/status decisions and the later paid-through date. This records receipts; it does not charge a payment card. |
| High | Production startup imported Vite/build configuration even in production. | Load tooling only inside the development branch. Production boot passes when resolution of every declared devDependency is explicitly blocked. |
| Medium | Older editors could overwrite newer menu/profile changes. | Compare supplied editor revision after acquiring the row lock. Reject stale saves with 409 and leave stored data intact. Manager UI supplies the revision. |
| Medium | Price/date/text inputs accepted ambiguous or excessively large values. | Explicit decimal precision/range, discount bounds, real calendar dates, unique bounded tags, non-negative integer order, field limits and strict schemas. Database checks reinforce roles, price bounds and uniqueness. |
| Medium | Raw JSON uploads were consumed by the global parser; empty, truncated or replayed uploads could fail incorrectly. | Exclude signed upload paths from JSON parsing. Enforce 5 MB, signature/expiry/live owner, basic media structure/dimensions and single-use completion. Replay returns 409. WebP checks include chunk lengths and dimensions. |
| Medium | Uploaded cover type was guessed from a UUID URL; a failed save could still display a success toast. | Include original MIME information in upload completion, check save responses, derive persisted media kind from stored MIME, restrict image-only fields, and match the UI's accepted formats to the backend. |
| Medium | Saved profile cover media did not appear on the public menu. | Render a configured image/GIF/video cover; video pauses when menu motion is disabled or the page is hidden. No cover is added to existing cafés automatically. |
| Medium | Unpublished profile edits disappeared when following another page link. | Show an accessible Keep editing / Discard and leave dialog, with native unload protection. Draft initialization occurs before paint; stale saved profile labels refresh after publication. |
| Medium | API failures could expose internal errors or leave the interface without useful recovery. | Controlled JSON 400/409/413/500 responses, safer error logging, request-body limits, abortable queries, periodic identity refresh and a render/chunk error boundary. Logout checks the actual server response. |
| Medium | Audit history lost useful café attribution after deletion. | Retain a café-name snapshot alongside the real actor, role, resource, response status and time. Resolve platform item/category targets before deletion. No request bodies or passwords are recorded. |
| Medium | QR copy/download success was announced before the browser operation completed; QR could overflow small phones. | Await and handle failures, update QR data when the café changes, add accessible controls and responsive canvas sizing. Explain why a localhost QR is unsuitable for guests' phones. |
| Medium | Launcher readiness could wait indefinitely or report a failed server as ready. | Bounded Node fetch readiness checks; verify the listener/process belongs to this application before reusing/stopping it. Launch helpers stay hidden. |
| Low | A large all-pages entry bundle made guest browsing load unrelated admin code. | Lazy-load page routes with Suspense. Entry is approximately 353 KB raw / 113 KB gzip; customer route is approximately 98 KB raw / 37 KB gzip. Keep the four font families actually used. |
| Low | Unknown super-admin routes could render an empty screen. | Restore the Not Found fallback for unknown routes. |
| High, contained | Nested old esbuild remained vulnerable in development tooling. | Override and deduplicate to patched esbuild 0.25.12; retain the checked lockfile. [Primary advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99). |

Removed superseded unsafe route handlers rather than leaving competing implementations. Migration `0003_safe_mercury.sql` is applied. A stopped-database recovery copy was made before the migration at `data/audit-backup-20261009-221538`; it contains the database and migrations, not the photo files.

## Permissions verified

Café managers control their own café only. Super admins control the platform and explicitly open any café workspace while retaining their own identity. Writes from stale workspace tabs are rejected. The real actor is recorded in audit history.

Server checks reject other café IDs, category/item/option reassignment, forged context headers, forbidden account/billing fields, registration role injection and platform endpoints used by managers. User and owner responses omit password hashes; public menus omit account/billing details and hidden items/options. Role changes and password resets revoke existing sessions. The last super admin is protected. [Permission model](RBAC.md).

## Verification results

| Check | Result / evidence |
| --- | --- |
| Adversarial API regression | 11 workflow groups pass: browser-origin enforcement, headers, credentials, input validation, stale saves, legacy pricing, uploads, concurrent receipts, throttling, safe errors, export context, audit attribution and cleanup. [Report](test-data/audit-verification.json) |
| RBAC regression | 8 workflow groups pass, including allowed/denied access, session revocation and cross-café isolation. [Report](test-data/rbac-verification.json) |
| Manager/category regression | 7 workflow groups pass. Test item/category/photo removed; initial café data restored exactly. [Report](test-data/manager-verification.json) |
| Global menu library | 9 workflow groups pass. All 70 reusable templates retain photos and pricing; copies are independent; duplicate concurrent imports are skipped; foreign targets/currency mismatch are rejected. [Report](test-data/menu-library-verification.json) |
| Isolated production runtime | Production boots with all devDependency imports blocked, migrates a separate fresh database, serves the homepage/public API and rejects anonymous private access. Test database removed. [Report](test-data/production-runtime-verification.json) |
| Source menu / image preservation | 70 items, 16 categories, four options. All 70 public 1024×1024 WebP files match their installed source bytes. Original item fields and prices preserved. [Report](test-data/urban-photo-verification.json) |
| Menu discovery / wheel logic | Food 12 / Snacks 12 / Drinks 44 / Sweets 2; wheel geometry, unique choices and empty/single pools pass. `scripts/verify-menu-discovery.ts` |
| Browser | Profile keep/discard, real menu export, 70-item editor, 390/320px guest layouts, Drinks filter, search, espresso option 10→12 QAR, wheel result→item, 320px QR canvas and Not Found recovery checked. No captured console errors/warnings in checked pages. [Report](test-data/audit-browser-verification.json) |
| TypeScript / build | `npm run check` and `npm run build` pass. A PostCSS plugin still emits a missing-`from` warning; checked assets render correctly. |
| Dependency audit | Production: zero reported advisories. Full tree: 7 high findings in the build-tool chain, reduced from 11 total. [Production audit](test-data/dependency-audit-production.json), [full audit](test-data/dependency-audit-after.json). |

These are workflow groups with multiple assertions, not a count of individual test assertions. Mutable verification removed its own fixtures. Urban/E3 accounts, ownership, profiles and original menu data were preserved.

## Remaining limits and launch requirements

1. **Upstream build-tool issue:** braces ≤3.0.3 still has no published patched version in the [primary advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The 7 full-tree findings trace to that build dependency chain. It is absent from the production dependency graph and the production startup test blocks build-tool imports. Build trusted source/configuration; do not expose the development server to guests. A major Tailwind migration or private fork would be a separate maintenance change, not an honest claim of a published patch.
2. **Guest access:** this run is on localhost. A stable address reachable by guest phones and HTTPS are required before printing guest QR codes. Set secure cookies for HTTPS. Enable `TRUST_PROXY=true` only behind the intended trusted single reverse proxy.
3. **Backup/recovery:** the JSON export excludes photo files and is not a full restore package. Stop the server and back up the complete `data/` directory and private `.env`; keep a protected off-machine copy. No scheduled backup/monitoring service was deployed by this audit.
4. **Operating model:** embedded PGlite uses one server process per data directory. This audit does not establish distributed-server, high-volume load or failover readiness. Rate buckets reset with a process restart; public signup has no email verification. Audit history shows the most recent 200 events.
5. **Media/testing scope:** uploads have type/size/basic structure checks, not antivirus scanning or full media decoding/transcoding. Phone checks use browser viewport emulation, not physical iPhone/Android devices. The new draft dialog guards page links and native unload; programmatic navigation/browser history are not covered by that link interceptor.
6. **Product scope:** favorites and the wheel are browsing aids. They do not submit orders, process checkout, or verify that generated photographs exactly match the café's plated food.

## Evidence screenshots

![Audited Urban manager workspace](test-data/AUDIT-MANAGER.png)
![390px glass details with double espresso selected](test-data/AUDIT-MOBILE-DETAIL.png)
