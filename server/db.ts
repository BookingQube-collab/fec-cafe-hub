import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@shared/schema';
import path from 'node:path';
import fs from 'node:fs';
const dataDir = path.resolve(process.env.DATA_DIR || 'data/database');
fs.mkdirSync(path.dirname(dataDir), { recursive: true });
export const pool = new PGlite(dataDir);
export const db = drizzle(pool, { schema });
export async function initializeDatabase() {
  await migrate(db, { migrationsFolder: path.resolve('migrations') });
}
