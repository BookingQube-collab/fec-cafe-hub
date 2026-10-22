import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { modifierFixture } from './modifier-fixture';
import { users, restaurants, categories, menuItems, menuItemPriceVariants } from '../shared/schema';

const root = path.resolve('data/modifier-preview-' + randomUUID());
fs.mkdirSync(root, { recursive: true });
const database = path.join(root, 'database');
const engine = await PGlite.create(database), db = drizzle(engine);
await migrate(db, { migrationsFolder: 'migrations' });
const owner = randomUUID(), cafe = randomUUID(), category = randomUUID(), item = randomUUID();
const password = 'Preview-' + randomBytes(16).toString('hex'), email = 'preview@options.test';
await db.insert(users).values({ id: owner, email, password: await bcrypt.hash(password, 12), firstName: 'Test', lastName: 'Manager' });
await db.insert(restaurants).values({ id: cafe, userId: owner, name: 'Options Demo · Test Café', currency: 'QAR', theme: 'urban' });
await db.insert(categories).values({ id: category, restaurantId: cafe, title: 'Wraps' });
await db.insert(menuItems).values({ id: item, categoryId: category, name: 'Chicken Wrap', description: 'Isolated test example for configurable sauces and toppings.', price: '20', discount: '10', unit: 'wrap', hasMultiplePricing: true, modifierGroups: modifierFixture });
await db.insert(menuItemPriceVariants).values([
  { menuItemId: item, label: 'Regular', price: '20', discount: '10', unit: 'wrap', order: 0 },
  { menuItemId: item, label: 'Large', price: '25', discount: '20', unit: 'wrap', order: 1 },
]);
await engine.close();
const log = fs.openSync(path.join(root, 'server.log'), 'a');
const errorLog = fs.openSync(path.join(root, 'server-error.log'), 'a');
const child = spawn(process.execPath, ['dist/index.js'], { cwd: process.cwd(), windowsHide: true, detached: true, stdio: ['ignore', log, errorLog],
  env: { ...process.env, NODE_ENV: 'production', DATA_DIR: database, PORT: '5102', COOKIE_SECURE: 'false', SESSION_SECRET: randomBytes(48).toString('hex') } });
child.unref(); fs.closeSync(log); fs.closeSync(errorLog);
fs.writeFileSync('data/modifier-preview-session.json', JSON.stringify({ root, pid: child.pid, email, password, cafe, item, url: `http://localhost:5102/menu/${cafe}` }, null, 2));
console.log(JSON.stringify({ preview: `http://localhost:5102/menu/${cafe}`, pid: child.pid, isolated: true }));
