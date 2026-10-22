import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const [major,minor]=process.versions.node.split('.').map(Number);
assert.ok(major>22||major===22&&minor>=12,'Use Node.js 22.12 or newer.');
if(process.env.WORKERS_CI==='1'){
 for(const name of ['.env','.env.cloud']) assert.ok(!fs.existsSync(name),'Runtime environment files must stay outside the build checkout.');
}
for(const directory of ['data','test-data']) fs.mkdirSync(directory,{recursive:true});
const run=(file,args=[])=>execFileSync(process.execPath,[path.resolve(file),...args],{stdio:'inherit',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
const npm=process.env.npm_execpath;
assert.ok(npm,'Run this gate through npm run ci:build.');
for(const name of ['check','test','build']) run(npm,['run',name]);
run('scripts/verify-artifact-hardening.mjs');
run('node_modules/wrangler/bin/wrangler.js',['deploy','--config','wrangler.jsonc','--dry-run','--outdir','dist/worker']);
run('node_modules/tsx/dist/cli.mjs',['scripts/verify-workers.ts']);
run('scripts/verify-production-runtime.mjs');
console.log('PASS: deployment gate completed. Tests used disposable data and mocked external services; no runtime secrets or migrations were changed.');
