import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', `SESSION_SECRET=${randomBytes(48).toString('hex')}\nPORT=5100\nCOOKIE_SECURE=false\n`, { mode: 0o600 });
}
config();
const { initializeDatabase, pool } = await import('../server/db');
const { storage } = await import('../server/storage');
await initializeDatabase();
if ((await storage.getAllUsers()).length === 0) {
  const platformPassword = randomBytes(15).toString('base64url');
  await storage.createUser({ email: 'platform@cafe.local', password: platformPassword, firstName: 'Platform', lastName: 'Manager', role: 'super_admin' });
  fs.writeFileSync('SETUP-CREDENTIALS.txt', `Platform manager\nEmail: platform@cafe.local\nPassword: ${platformPassword}\n\nCreate real café accounts in the super-admin dashboard. Keep this file private.\n`, { mode: 0o600 });
  console.log('Created the platform administrator. No test cafés or menu items were seeded. Login details saved in SETUP-CREDENTIALS.txt.');
} else console.log('Already configured. Existing café data retained.');
await pool.close();
