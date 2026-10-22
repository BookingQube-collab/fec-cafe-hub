import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

export const tables = ['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit'];
const source = process.argv[2];
if (!source) throw new Error('Provide the database directory from a stopped-server backup.');
const database = await fs.realpath(path.resolve(source));
if (database.toLowerCase() === path.resolve('data/database').toLowerCase()) throw new Error('Do not open the live database. Use scripts/backup-local.ps1 first.');
const snapshot = { format: 1, exportedAt: new Date().toISOString(), tables: {}, media: [] };
const pg = await PGlite.create(database);
try {
  for (const table of tables) snapshot.tables[table] = (await pg.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
} finally { await pg.close(); }
const mediaDirectory = path.resolve(path.dirname(database), 'uploads');
for (const filename of await fs.readdir(mediaDirectory)) {
  if (!/^[a-f0-9-]{36}\.json$/.test(filename)) continue;
  const id = filename.slice(0,-5), meta = JSON.parse(await fs.readFile(path.join(mediaDirectory, filename), 'utf8'));
  const body = await fs.readFile(path.join(mediaDirectory, id));
  if (!snapshot.tables.users.some(u => u.id === meta.owner)) continue;
  snapshot.media.push({ id, owner: meta.owner, mime: meta.mime, size: body.length, sha256: createHash('sha256').update(body).digest('hex') });
}
await fs.mkdir('data/cloud-migration', { recursive: true });
await fs.writeFile('data/cloud-migration/snapshot.json', JSON.stringify(snapshot), { mode: 0o600 });
await fs.writeFile('data/cloud-migration/source.txt', mediaDirectory, { mode: 0o600 });
console.log('Private migration snapshot saved. Existing login sessions are intentionally excluded.');
console.log('Rows:', Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length])), 'Photos:', snapshot.media.length);
