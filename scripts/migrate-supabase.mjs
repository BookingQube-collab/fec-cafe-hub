import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { Client, types } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
config({ path: '.env.cloud', quiet: true });
process.env.TZ = 'UTC';
types.setTypeParser(1114, value => new Date(value + 'Z'));
const required = ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
if (required.some(key => !process.env[key])) throw new Error('Fill private .env.cloud before migrating.');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.SUPABASE_URL)) throw new Error('Use a hosted Supabase project URL');
const snapshot = JSON.parse(await fs.readFile('data/cloud-migration/snapshot.json','utf8'));
const mediaRoot = (await fs.readFile('data/cloud-migration/source.txt', 'utf8')).trim();
const tableNames = ['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit'];
if (snapshot.format !== 1 || tableNames.some(table => !Array.isArray(snapshot.tables[table]))) throw new Error('Invalid migration snapshot');
const bucket = process.env.STORAGE_BUCKET || 'cafe-media';
if (bucket !== 'cafe-media') throw new Error('Security setup currently expects the cafe-media bucket');
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
await client.connect();
try {
  // Refuse to seed an unrelated database/project or overwrite an existing café.
  const existence = await client.query("SELECT to_regclass('public.users') AS users");
  if (existence.rows[0].users) {
    const current = await client.query('SELECT count(*) AS n FROM users');
    if (Number(current.rows[0].n)) throw new Error('Target already contains users. This importer only seeds a fresh dedicated project.');
  }
  await migrate(drizzle(client), { migrationsFolder: 'migrations' });
  await client.query(await fs.readFile('deployment/supabase-security.sql','utf8'));
  const bucketResponse = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket/${bucket}`, { headers });
  if (!bucketResponse.ok) throw new Error('Private photo bucket unavailable');
  const bucketDetails = await bucketResponse.json();
  if (bucketDetails.public) throw new Error('Photo bucket must remain private');
  for (const meta of snapshot.media) {
    if (!/^[a-f0-9-]{36}$/.test(meta.id)) throw new Error('Invalid photo identifier');
    const body = await fs.readFile(path.join(mediaRoot, meta.id));
    if (body.length !== meta.size || createHash('sha256').update(body).digest('hex') !== meta.sha256) throw new Error('Photo changed since export');
    const uploaded = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${meta.id}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': meta.mime, 'x-upsert': 'false' }, body,
    });
    if (!uploaded.ok) {
      const existing = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${meta.id}`, { headers });
      if (!existing.ok || createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex') !== meta.sha256) throw new Error('Upload failed or conflicts with an existing photo');
    }
  }
  // Uploads are idempotent by checksum; data is committed once, atomically.
  await client.query('BEGIN');
  try {
    const columns = await client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'");
    for (const table of tableNames) {
      const allowed = new Map(columns.rows.filter(c => c.table_name === table).map(c => [c.column_name,c.data_type]));
      for (const row of snapshot.tables[table]) {
        const keys = Object.keys(row); if (keys.some(key => !allowed.has(key))) throw new Error('Snapshot schema differs from target');
        const values = keys.map(key => ['json','jsonb'].includes(allowed.get(key)) && row[key] !== null ? JSON.stringify(row[key]) : row[key]);
        await client.query(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_,i) => `$${i+1}`).join(',')})`, values);
      }
    }
    for (const meta of snapshot.media) await client.query('INSERT INTO media_objects (id,owner_id,mime,size) VALUES ($1,$2,$3,$4)', [meta.id,meta.owner,meta.mime,meta.size]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  for (const table of tableNames) {
    const result = await client.query(`SELECT count(*) AS n FROM "${table}"`);
    if (Number(result.rows[0].n) !== snapshot.tables[table].length) throw new Error(`Row verification failed: ${table}`);
  }
  console.log('Supabase migration complete: all café rows and photo checksums verified.');
} finally { await client.end(); }
