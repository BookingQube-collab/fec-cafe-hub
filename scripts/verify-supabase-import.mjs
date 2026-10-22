import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { Client, types } from 'pg';
config({ path: '.env.cloud', quiet: true });
types.setTypeParser(1114, value => new Date(value + 'Z'));
const snapshot = JSON.parse(fs.readFileSync('data/cloud-migration/snapshot.json','utf8'));
const tables = ['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit'];
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
const check = (ok, label) => { if (!ok) throw new Error(label); };
await client.connect();
try {
  for (const table of tables) {
    const actual = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
    check(JSON.stringify(actual) === JSON.stringify(snapshot.tables[table]), `${table}: imported values differ`);
  }
  check(Number((await client.query('SELECT count(*) AS n FROM sessions')).rows[0].n) === 0, 'Expected fresh sign-ins after import');
  check(Number((await client.query('SELECT count(*) AS n FROM media_objects')).rows[0].n) === snapshot.media.length, 'Media ownership count differs');
  const protectedTables = [...tables, 'sessions','media_objects','rate_limit_buckets'];
  const permissions = await client.query("SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') AS anon_read,has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_read FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1)", [protectedTables]);
  check(permissions.rows.length === protectedTables.length && permissions.rows.every(r => r.relrowsecurity && !r.anon_read && !r.authenticated_read), 'Browser database roles must not read app tables');
  check((await client.query("SELECT public FROM storage.buckets WHERE id='cafe-media'")).rows[0]?.public === false, 'Media bucket must remain private');
  const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
  for (let offset=0; offset<snapshot.media.length; offset+=4) {
    await Promise.all(snapshot.media.slice(offset,offset+4).map(async meta => {
      const stored = (await client.query('SELECT owner_id,mime,size FROM media_objects WHERE id=$1',[meta.id])).rows[0];
      check(stored?.owner_id === meta.owner && stored.mime === meta.mime && stored.size === meta.size, 'Media ownership metadata differs');
      const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/cafe-media/${meta.id}`, { headers, redirect:'error', signal:AbortSignal.timeout(30000) });
      check(response.ok, 'Imported photo unavailable');
      const bytes = Buffer.from(await response.arrayBuffer());
      check(bytes.length === meta.size && createHash('sha256').update(bytes).digest('hex') === meta.sha256, 'Imported photo checksum differs');
    }));
    if ((offset+4)%20 === 0) console.log(`Verified ${Math.min(offset+4,snapshot.media.length)} imported photos`);
  }
  fs.writeFileSync('data/cloud-import-verification.json',JSON.stringify({ testedAt:new Date().toISOString(), rows:Object.fromEntries(tables.map(t => [t,snapshot.tables[t].length])),photos:snapshot.media.length,exactValues:true,browserRolesBlocked:true,privateBucket:true },null,2));
  console.log('Live import verified: exact café records, ownership, all photo checksums, and database role isolation.');
} finally { await client.end(); }
