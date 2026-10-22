import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
config({ path:'.env.cloud',quiet:true });
const env = process.env;
const fields = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SESSION_SECRET','PASSWORD_SERVICE_SECRET'];
if (fields.some(key => !env[key] || env[key].includes('YOUR_PROJECT'))) throw new Error('Fill private .env.cloud first.');
if (!/^[a-f0-9]{64}$/.test(env.PASSWORD_SERVICE_SECRET) || env.SESSION_SECRET.length < 48) throw new Error('Use the generated independent secrets.');
if (!fs.readFileSync('wrangler.jsonc','utf8').includes('"hyperdrive"')) throw new Error('Configure Hyperdrive before publishing.');
// Run Wrangler directly through Node: secret values never enter argv.
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const secretsFile = '.cloud-secrets.json';
if (fs.existsSync(secretsFile)) throw new Error('A temporary Worker secrets file already exists; review it before retrying.');
const cliEnv = { ...env, WRANGLER_LOG_PATH:fs.realpathSync('data')+'/wrangler-deploy.log', WRANGLER_SEND_METRICS:'false' };
for (const key of [...fields,'DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_REF']) delete cliEnv[key];
async function run(args, input) {
  await new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[wrangler,...args],{ stdio:['pipe','inherit','inherit'],env:cliEnv });
    child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(new Error(`Wrangler ${args[0]} failed`)));
    child.stdin.end(input || '');
  });
}
await run(['whoami']);
// First deployment includes only these four secrets, atomically with the app.
// Secret values never appear in shell arguments or terminal output.
fs.writeFileSync(secretsFile, JSON.stringify(Object.fromEntries(fields.map(key => [key,env[key]]))), { flag:'wx',mode:0o600 });
try {
  // Keep staff working before turning the permanent QR origin into read-only.
  for (const filename of ['wrangler.staff.jsonc','wrangler.jsonc']) {
    const config = fs.readFileSync(filename,'utf8');
    if (!config.includes('"account_id": "69e2ef22efdd52ebbc1aefc3d8aa8980"') || !config.includes('"preview_urls": false')) throw new Error('Deployment must stay in Cafe Menu with preview URLs disabled.');
  }
  await run(['deploy','--config','wrangler.staff.jsonc','--secrets-file',secretsFile]);
  await new Promise((resolve,reject) => {
    const child = spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/verify-menu-isolation.ts','--staff-only'],{stdio:'inherit',env:cliEnv});
    child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(new Error('Staff verification failed; public deployment has not been changed.')));
  });
  await run(['deploy','--config','wrangler.jsonc','--secrets-file',secretsFile]);
}
finally { fs.unlinkSync(secretsFile); }
