import { config } from 'dotenv';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Client } from 'pg';
config({path:'.env.cloud',quiet:true});
assert.ok(/^[a-z]{20}$/.test(process.env.SUPABASE_PROJECT_REF || ''), 'SUPABASE_PROJECT_REF must be the 20-letter project ref');
assert.equal(process.env.SUPABASE_URL, `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`);
const tables=['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit','sessions','media_objects','rate_limit_buckets'];
const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,statement_timeout:15000});
try {
  await client.connect();
  const {rows}=await client.query(`SELECT c.relname AS name,c.relrowsecurity AS rls,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_access,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS authenticated_access
    FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,[tables]);
  assert.equal(rows.length,tables.length);
  for(const row of rows) {assert.equal(row.rls,true,row.name+' must enable RLS');assert.equal(row.anon_access,false,row.name+' must deny anon');assert.equal(row.authenticated_access,false,row.name+' must deny direct browser access');}
  const bucket=(await client.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='cafe-media'")).rows[0];
  assert.ok(bucket);assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);
  assert.deepEqual([...bucket.allowed_mime_types].sort(),['image/png','image/jpeg','image/gif','image/webp','video/mp4'].sort());
  assert.ok(process.env.SESSION_SECRET.length>=48);
  const report={at:new Date().toISOString(),project:process.env.SUPABASE_PROJECT_REF,tables:rows,privateBucket:true,mediaSizeLimit:5242880,sessionSecretValid:true,readOnlyAudit:true};
  await fs.writeFile('data/hardening-database-verification.json',JSON.stringify(report,null,2));
  console.log('PASS: all 11 cafe tables enforce RLS and deny anon/authenticated direct access; photo bucket is private with bounded MIME/size; session secret format is valid.');
} catch(error) { console.error('Cloud hardening verification failed',{type:error.name,code:error.code,message:error instanceof assert.AssertionError?error.message:'Check provider connectivity and the private report.'});process.exitCode=1; }
finally {await client.end().catch(()=>{});}
