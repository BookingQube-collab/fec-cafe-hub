import {config} from 'dotenv';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import assert from 'node:assert/strict';
config({path:'.env.cloud',quiet:true});
assert.equal(process.env.SUPABASE_PROJECT_REF,'kfxdazzbnbbhzbkplpqf');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
try {
  const before=(await pool.query('SELECT id,email,role FROM users ORDER BY id')).rows;
  await migrate(drizzle(pool),{migrationsFolder:'migrations'});
  const after=(await pool.query('SELECT id,email,role FROM users ORDER BY id')).rows;
  assert.deepEqual(after,before);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM users WHERE account_status <> 'active'")).rows[0].n),0);
  console.log('PASS: additive account-status migration applied; existing accounts preserved and active.');
} finally {await pool.end();}
