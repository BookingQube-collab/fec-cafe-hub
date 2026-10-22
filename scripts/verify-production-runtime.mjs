import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve('data/audit-runtime');
const directory = path.resolve(root, randomUUID());
assert.ok(directory.startsWith(root + path.sep));
await fs.mkdir(directory, { recursive: true });
const loader = pathToFileURL(path.resolve('scripts/block-dev-dependencies.mjs')).href;
const bootstrap = 'data:text/javascript,' + encodeURIComponent(`import { register } from 'node:module'; register(${JSON.stringify(loader)}, import.meta.url);`);
const child = spawn(process.execPath, ['--import', bootstrap, 'dist/index.js'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: '5101', DATA_DIR: path.join(directory, 'database'), SESSION_SECRET: randomUUID() + randomUUID() }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let errors = '', output = '', exited = false;
child.stderr.on('data', bytes => errors += bytes.toString());
child.stdout.on('data', bytes => output += bytes.toString());
child.once('exit', () => exited = true);
try {
  const deadline = Date.now() + 20000;
  let ready = false;
  while (Date.now() < deadline && !exited) {
    try { ready = (await fetch('http://127.0.0.1:5101/api/cafes', { signal: AbortSignal.timeout(1000) })).status === 200; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready && !exited && output.includes('serving on port 5101'), errors || 'Isolated production server did not start');
  const home = await fetch('http://127.0.0.1:5101/');
  assert.equal(home.status, 200); assert.ok((await home.text()).includes('id="root"'));
  assert.equal(home.headers.get('cache-control'),'no-store');
  assert.ok(home.headers.get('content-security-policy')?.includes("object-src 'none'"));
  assert.equal((await fetch('http://127.0.0.1:5101/index.html')).headers.get('cache-control'),'no-store');
  assert.equal((await fetch('http://127.0.0.1:5101/api/auth/user')).status, 401);
  assert.deepEqual(await (await fetch('http://127.0.0.1:5101/api/cafes')).json(), []);
  assert.equal(errors, '');
  const report = { verifiedAt: new Date().toISOString(), checks: ['Production server boots while resolution of every declared development dependency is blocked.', 'Fresh isolated database migrates; static homepage and public API respond; protected identity endpoint rejects anonymous access.', 'Live cafe database is never opened by the smoke-test process.'] };
  await fs.writeFile('test-data/production-runtime-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (!exited) { child.kill('SIGTERM'); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 5000).unref(); }); }
  assert.ok(directory.startsWith(root + path.sep));
  await fs.rm(directory, { recursive: true, force: true });
}
