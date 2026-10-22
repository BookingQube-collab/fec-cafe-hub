import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);');
const socket = new PGLiteSocketServer({ db, port:0, host:'127.0.0.1',maxConnections:4 }); await socket.start();
const objects = new Map(), fetchBefore = globalThis.fetch;
process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`;
process.env.SUPABASE_URL = 'https://migration-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'migration-test-key';
process.env.STORAGE_BUCKET = 'cafe-media';
globalThis.fetch = async (url, options) => {
  const parsed = new URL(url);
  assert.equal(parsed.host,'migration-test.supabase.co','Never contact an external account during this test');
  if (parsed.pathname === '/storage/v1/bucket/cafe-media') return Response.json({ public:false });
  const id = parsed.pathname.split('/').pop();
  if (options.method === 'POST') { objects.set(id,Buffer.from(options.body)); return Response.json({}); }
  return objects.has(id) ? new Response(objects.get(id)) : new Response('',{status:404});
};
try {
  await import('./migrate-supabase.mjs');
  const snapshot = JSON.parse(await fs.readFile('data/cloud-migration/snapshot.json','utf8'));
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    const imported = (await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
    assert.deepEqual(JSON.parse(JSON.stringify(imported)),rows, `${table} values, links, arrays, JSON and timestamps must match`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM media_objects')).rows[0].n,snapshot.media.length);
  assert.equal(objects.size,snapshot.media.length);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,0);
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT * FROM users'),error => error.code === '42501');
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await assert.rejects(db.query('SELECT * FROM menu_items'),error => error.code === '42501');
  await db.exec('RESET ROLE');
  await assert.rejects(import('./migrate-supabase.mjs?retry'),/Target already contains users/);
  console.log('Migration rehearsal passed: exact row comparison, photo checksums, empty sessions, browser-role isolation, and refusal to overwrite an existing project.');
} finally { globalThis.fetch = fetchBefore; await socket.stop(); await db.close(); }
