import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
const filename = '.env.cloud';
if (!fs.existsSync(filename)) {
  const template = fs.readFileSync('.env.cloud.example', 'utf8')
    .replace('SESSION_SECRET=\n', `SESSION_SECRET=${randomBytes(48).toString('hex')}\n`)
    .replace('PASSWORD_SERVICE_SECRET=\n', `PASSWORD_SERVICE_SECRET=${randomBytes(32).toString('hex')}\n`);
  fs.writeFileSync(filename, template, { mode: 0o600, flag: 'wx' });
  console.log('Created private .env.cloud. Fill the Supabase project fields locally; never paste credentials into chat.');
}
const hyperdriveId = process.argv[2];
if (hyperdriveId) {
  if (!/^[a-f0-9]{32}$/.test(hyperdriveId)) throw new Error('Provide a valid Hyperdrive ID');
  const config = fs.readFileSync('wrangler.jsonc', 'utf8');
  if (config.includes('"hyperdrive"')) throw new Error('Hyperdrive is already configured. Review wrangler.jsonc before changing it.');
  fs.writeFileSync('wrangler.jsonc', config.replace('"workers_dev": true,', `"workers_dev": true,\n  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${hyperdriveId}" }],`));
  console.log('Added Hyperdrive binding. Query caching must be disabled for fresh role and session checks.');
}
const env = parse(fs.readFileSync(filename));
const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','SUPABASE_PROJECT_REF','SESSION_SECRET','PASSWORD_SERVICE_SECRET'];
console.log('Configuration status:', required.map(key => `${key}: ${env[key] && !env[key].includes('YOUR_PROJECT') ? 'set' : 'missing'}`).join(', '));
