/**
 * Convert backup/database.json (+ backup/media) into data/cloud-migration/
 * for scripts/migrate-supabase.mjs. Creates placeholder manager users for
 * restaurant.user_id values (backup excludes passwords).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const root = path.resolve('.');
const backupJson = path.join(root, 'backup', 'database.json');
const backupMedia = path.join(root, 'backup', 'media');
const outDir = path.join(root, 'data', 'cloud-migration');
const mediaOut = path.join(outDir, 'media');
const notesPath = path.join(root, 'data', 'manager-password-reset.txt');

const slug = (name) => name
  .normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .slice(0, 40) || 'cafe';

const backup = JSON.parse(await fs.readFile(backupJson, 'utf8'));
if (backup.format !== 1 || !Array.isArray(backup.cafes)) {
  throw new Error('Unexpected backup/database.json format');
}

const tempPassword = `TempRestore-${randomBytes(9).toString('base64url')}`;
const passwordHash = await bcrypt.hash(tempPassword, 12);
const now = new Date().toISOString();

const users = [];
const restaurants = [];
const categories = [];
const menuItems = [];
const priceVariants = [];
const notes = [
  'PLACEHOLDER MANAGER ACCOUNTS — passwords were NOT in the backup.',
  'Reset these after first login (or via platform password reset).',
  `Generated: ${now}`,
  `Temporary shared password (change immediately): ${tempPassword}`,
  '',
];

for (const cafe of backup.cafes) {
  const restaurant = cafe.restaurant;
  if (!restaurant?.id || !restaurant.user_id) throw new Error('Cafe missing restaurant id/user_id');
  const email = `manager+${slug(restaurant.name)}@restore.local`;
  users.push({
    id: restaurant.user_id,
    email,
    password: passwordHash,
    first_name: 'Manager',
    last_name: restaurant.name,
    profile_image_url: null,
    role: 'admin',
    account_status: 'active',
    created_at: restaurant.created_at || now,
    updated_at: restaurant.updated_at || restaurant.created_at || now,
  });
  notes.push(`${restaurant.name}`);
  notes.push(`  user_id: ${restaurant.user_id}`);
  notes.push(`  email:   ${email}`);
  notes.push('');
  restaurants.push(restaurant);
  categories.push(...(cafe.categories || []));
  menuItems.push(...(cafe.menuItems || []));
  priceVariants.push(...(cafe.priceVariants || []));
}

const snapshot = {
  format: 1,
  exportedAt: new Date().toISOString(),
  source: 'backup/database.json',
  tables: {
    users,
    restaurants,
    categories,
    menu_items: menuItems,
    menu_item_price_variants: priceVariants,
    global_menu_items: backup.sharedMenuLibrary || [],
    payments: [],
    access_audit: [],
  },
  media: [],
};

await fs.mkdir(mediaOut, { recursive: true });
for (const meta of backup.media || []) {
  if (!/^[a-f0-9-]{36}$/.test(meta.id)) throw new Error(`Invalid media id ${meta.id}`);
  const filename = path.basename(meta.filename || `${meta.id}`);
  const sourcePath = path.join(backupMedia, filename);
  const body = await fs.readFile(sourcePath);
  if (body.length !== meta.size) throw new Error(`Size mismatch for ${meta.id}`);
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (sha256 !== meta.sha256) throw new Error(`Checksum mismatch for ${meta.id}`);
  // migrate-supabase.mjs reads path.join(mediaRoot, meta.id) with no extension
  await fs.writeFile(path.join(mediaOut, meta.id), body, { mode: 0o600 });
  snapshot.media.push({
    id: meta.id,
    owner: meta.owner_id,
    mime: meta.mime,
    size: meta.size,
    sha256,
  });
}

await fs.writeFile(path.join(outDir, 'snapshot.json'), JSON.stringify(snapshot), { mode: 0o600 });
await fs.writeFile(path.join(outDir, 'source.txt'), mediaOut, { mode: 0o600 });
await fs.writeFile(notesPath, notes.join('\n') + '\n', { mode: 0o600 });

console.log('Converted backup → data/cloud-migration/');
console.log('Rows:', Object.fromEntries(Object.entries(snapshot.tables).map(([t, rows]) => [t, rows.length])));
console.log('Photos:', snapshot.media.length);
console.log('Manager reset notes:', notesPath);
