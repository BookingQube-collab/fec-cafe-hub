import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { config } from 'dotenv';
config({path:'.env.cloud',quiet:true});
if(process.env.SUPABASE_PROJECT_REF!=='kfxdazzbnbbhzbkplpqf') throw new Error('Use the dedicated café project.');
const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
const folder=path.resolve('data',`cloud-backup-${stamp}`);
await fs.mkdir(folder,{recursive:false}); await fs.mkdir(path.join(folder,'media'));
const tables=['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit','sessions','media_objects','rate_limit_buckets'];
const snapshot={format:1,exportedAt:new Date().toISOString(),project:process.env.SUPABASE_PROJECT_REF,tables:{},media:[]};
const client=new Client({connectionString:process.env.DATABASE_URL}); await client.connect();
try {
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 for(const table of tables) snapshot.tables[table]=(await client.query(`SELECT * FROM "${table}"`)).rows;
 snapshot.migrations=(await client.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows;
 await client.query('COMMIT');
} finally {await client.end();}
const queue=[...snapshot.tables.media_objects];
await Promise.all(Array.from({length:4},async()=>{
 while(queue.length){
  const meta=queue.shift();
  if(!/^[a-f0-9-]{36}$/.test(meta.id)) throw new Error('Unexpected photo identifier');
  const response=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/cafe-media/${meta.id}`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`Backup photo failed: HTTP ${response.status}`);
  const body=Buffer.from(await response.arrayBuffer());
  if(body.length!==meta.size) throw new Error('Backup photo size differs');
  await fs.writeFile(path.join(folder,'media',meta.id),body,{mode:0o600});
  snapshot.media.push({id:meta.id,owner:meta.owner_id,mime:meta.mime,size:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 }
}));
await fs.writeFile(path.join(folder,'snapshot.json'),JSON.stringify(snapshot),{mode:0o600});
await fs.cp('migrations',path.join(folder,'migrations'),{recursive:true});
await fs.writeFile(path.join(folder,'README.txt'),'Private database and photo recovery copy. Contains password hashes, sessions and account data; never publish. Reapply the saved schema in an empty café project and restore relational tables in dependency order. Fresh sessions are recommended on recovery. Restore all photo bytes and ownership records together. Worker code/secrets are backed up separately.\n',{mode:0o600});
await fs.writeFile('data/latest-cloud-backup.json',JSON.stringify({folder,createdAt:snapshot.exportedAt,rows:Object.fromEntries(tables.map(t=>[t,snapshot.tables[t].length])),photos:snapshot.media.length},null,2));
console.log(`Private cloud recovery copy complete: ${tables.length} tables and ${snapshot.media.length} photos.`);
