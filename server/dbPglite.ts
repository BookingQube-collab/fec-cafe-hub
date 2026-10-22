import * as schema from '@shared/schema';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
/** Local-only embedded Postgres. Imported dynamically from db.ts (not on Vercel). */
export async function initPgliteDatabase(migrationsFolder: string) {
  const dataDir = path.resolve(process.env.DATA_DIR || 'data/database');
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const local = new PGlite(dataDir);
  const embedded = drizzlePglite(local, { schema });
  await migratePglite(embedded, { migrationsFolder });
  return {
    pool: local as { close(): Promise<void> },
    db: embedded,
  };
}
