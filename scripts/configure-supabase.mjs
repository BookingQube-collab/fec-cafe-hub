import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

const filename = '.env.cloud';
if (!fs.existsSync(filename)) {
  const template = fs.readFileSync('.env.cloud.example', 'utf8')
    .replace('SESSION_SECRET=\n', `SESSION_SECRET=${randomBytes(48).toString('hex')}\n`);
  fs.writeFileSync(filename, template, { mode: 0o600, flag: 'wx' });
  console.log('Created private .env.cloud. Fill the Supabase project fields locally; never paste credentials into chat.');
}

const env = parse(fs.readFileSync(filename));
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'SUPABASE_PROJECT_REF', 'SESSION_SECRET'];
console.log('Configuration status:', required.map(key => `${key}: ${env[key] && !String(env[key]).includes('YOUR_PROJECT') ? 'set' : 'missing'}`).join(', '));
if (env.PUBLIC_URL) console.log('PUBLIC_URL:', env.PUBLIC_URL);
