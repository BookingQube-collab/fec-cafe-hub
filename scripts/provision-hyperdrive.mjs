import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { unstable_readConfig } from 'wrangler';
config({ path: '.env.cloud', quiet: true });
const env = { ...process.env, WRANGLER_LOG_PATH: fs.realpathSync('data') + '/wrangler-provision.log', WRANGLER_SEND_METRICS: 'false' };
const ref = env.SUPABASE_PROJECT_REF;
if (!/^[a-z]{20}$/.test(ref || '')) throw new Error('Missing café project reference.');
const db = new URL(env.DATABASE_URL || '');
if (!db.hostname.endsWith('.pooler.supabase.com') || decodeURIComponent(db.username) !== `postgres.${ref}`) throw new Error('Database configuration does not match this café project.');
const account = unstable_readConfig({ config: 'wrangler.jsonc' }).account_id;
if (!/^[a-f0-9]{32}$/.test(account || '')) throw new Error('Missing verified Cloudflare account.');
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
// Wrangler refreshes its approved OAuth session; capture credentials only in memory.
execFileSync(process.execPath, [wrangler, 'whoami'], { env, stdio: 'pipe' });
const auth = JSON.parse(execFileSync(process.execPath, [wrangler, 'auth', 'token', '--json'], { env, encoding: 'utf8', stdio: 'pipe' }));
if (auth.type !== 'oauth' || !auth.token) throw new Error('Use the approved Cloudflare OAuth login.');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs`;
const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
async function call(url, options = {}) {
  const response = await fetch(url, { ...options, headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(`Cloudflare Hyperdrive request failed (${response.status}; codes ${(body.errors || []).map(e => e.code).join(',')}).`);
  return body.result;
}
let resource = (await call(endpoint)).find(item => item.name === 'cafe-menu-db');
if (!resource) {
  resource = await call(endpoint, { method: 'POST', body: JSON.stringify({
    name: 'cafe-menu-db', caching: { disabled: true }, origin_connection_limit: 5, sslmode: 'require',
    origin: { host: `db.${ref}.supabase.co`, port: 5432, scheme: 'postgresql', database: 'postgres', user: 'postgres', password: decodeURIComponent(db.password) },
  }) });
}
if (resource.origin.host !== `db.${ref}.supabase.co` || resource.origin.user !== 'postgres' || resource.origin.database !== 'postgres' || resource.caching.disabled !== true) throw new Error('Existing Hyperdrive differs from the café configuration; refusing to overwrite it.');
fs.writeFileSync('data/cloud-resources.json', JSON.stringify({ account, supabaseProject: ref, hyperdrive: resource.id, hyperdriveName: resource.name }, null, 2));
const current = fs.readFileSync('wrangler.jsonc', 'utf8');
if (current.includes('"hyperdrive"')) {
  if (unstable_readConfig({ config: 'wrangler.jsonc' }).hyperdrive?.[0]?.id !== resource.id) throw new Error('A different Hyperdrive binding is configured.');
} else execFileSync(process.execPath, ['scripts/configure-cloud.mjs', resource.id], { stdio: 'inherit' });
console.log('Café Hyperdrive configured with query caching disabled.');
