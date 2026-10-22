import fs from 'node:fs';
import { parse } from 'dotenv';
import { Client } from 'pg';

const filename = '.env.cloud';
const text = fs.readFileSync(filename, 'utf8');
const env = parse(text);
const ref = env.SUPABASE_PROJECT_REF;
const host = process.argv[2];
if (!/^[a-z]{20}$/.test(ref || '') || env.SUPABASE_URL !== `https://${ref}.supabase.co`) throw new Error('Configure this project first.');
if (!/^aws-\d+-[a-z]+-[a-z]+-\d+\.pooler\.supabase\.com$/.test(host || '')) throw new Error('Provide the session pooler host shown in the project Connect dialog.');
const password = fs.readFileSync('data/supabase-db-password.txt', 'utf8').replace(/\r?\n$/, '');
if (!password || /[\r\n]/.test(password)) throw new Error('Save the database password as a single line in the private local password file.');
if (!fs.existsSync('data/supabase-ca.crt')) throw new Error('Download the CA certificate linked by this project’s database settings first.');
const caPath = encodeURIComponent(fs.realpathSync('data/supabase-ca.crt'));
const connection = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres?sslmode=verify-full&sslrootcert=${caPath}`;
const client = new Client({ connectionString: connection, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('SELECT 1');
  fs.writeFileSync(filename, text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${connection}`), { mode: 0o600 });
  console.log('Database TLS connection verified; connection string saved privately.');
} catch (error) {
  // Provider error messages can contain credentials; never print them.
  console.error('Database connection failed:', error.code || 'connection_error');
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
