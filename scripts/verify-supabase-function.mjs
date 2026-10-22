import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
config({ path: '.env.cloud', quiet: true });
const env = process.env;
const endpoint = `${env.SUPABASE_URL}/functions/v1/cafe-passwords`;
const metadata = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/functions/cafe-passwords`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
});
assert.equal(metadata.status, 200, 'Function metadata unavailable');
const fn = await metadata.json();
assert.equal(fn.verify_jwt, false, 'Function must check its independent private secret');
const durations = [];
async function call(body, authenticated = true) {
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${env.PASSWORD_SERVICE_SECRET}` } : {}),
  }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
  durations.push(Math.round(performance.now() - started));
  return response;
}
assert.equal((await call({}, false)).status, 401, 'Anonymous access must be denied');
assert.equal((await call({ operation: 'hash', password: 'test-invalid-cost', rounds: 31 })).status, 400);
assert.equal((await call({ operation: 'hash', password: 'x'.repeat(2048), rounds: 12 })).status, 413);
const password = randomBytes(18).toString('hex');
const nativeHash = await bcrypt.hash(password, 12);
const matched = await call({ operation: 'compare', password, hash: nativeHash });
assert.equal(matched.status, 200);
assert.equal((await matched.json()).valid, true, 'Existing bcrypt passwords must work');
const generated = await call({ operation: 'hash', password, rounds: 12 });
assert.equal(generated.status, 200);
assert.equal(await bcrypt.compare(password, (await generated.json()).hash), true);
fs.writeFileSync('data/cloud-function-verification.json', JSON.stringify({ testedAt: new Date().toISOString(), slug: 'cafe-passwords', version: fn.version, verifyJwt: fn.verify_jwt, checksPassed: 5, requestWallTimesMs: durations }, null, 2));
console.log('Live password function: all five authentication/input/bcrypt checks passed.');
