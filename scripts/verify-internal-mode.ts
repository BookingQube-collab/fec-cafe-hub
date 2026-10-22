import assert from 'node:assert/strict';
import fs from 'node:fs';
import { permanentMenuUrl } from '../shared/menuIdentity';
const origin = process.env.MANAGEMENT_ORIGIN || process.env.PUBLIC_URL || 'http://localhost:5100';
const sessions: string[] = [];
const checks: string[] = [];
async function request(method: string, path: string, body?: unknown, cookie = '', expected = 200) {
  const response = await fetch(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000), redirect: 'error' });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${data.message || response.status}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function login(email: string, file: string) {
  const text = fs.readFileSync(file, 'utf8');
  const password = text.slice(text.indexOf(`Email: ${email}`)).match(/Password: (.+)/)![1];
  const {cookie} = await request('POST','/api/login',{email,password}); sessions.push(cookie); return cookie;
}
try {
  const platform = await login('platform@cafe.local','SETUP-CREDENTIALS.txt');
  const manager = await login('manager@urban.cafe','URBAN-CAFE-CREDENTIALS.txt');
  await request('POST','/api/register-restaurant',{},'',410);
  await request('POST','/api/super-admin/restaurants',{},'',401);
  await request('POST','/api/super-admin/restaurants',{},manager,403);
  await request('POST','/api/super-admin/restaurants',{},platform,400);
  const before = (await request('GET','/api/super-admin/restaurants',undefined,platform)).data;
  const urban = before.find((c: {name:string}) => c.name === 'Urban Café');
  assert.ok(urban);
  assert.equal(new Set(before.map((c: {id:string}) => c.id)).size,before.length);
  const otherId = '11921092-7a48-4c24-b550-1947f0969732';
  await request('POST','/api/super-admin/payments',{restaurantId:urban.id,amount:100},platform,410);
  await request('GET',`/api/super-admin/payments/${urban.id}`,undefined,platform,410);
  await request('PUT',`/api/super-admin/restaurants/${urban.id}/subscription`,{monthlyFee:999},platform,410);
  await request('PUT','/api/restaurant/upi-qr',{upiQrCodeUrl:'/objects/obsolete'},manager,410);
  await request('POST','/api/super-admin/payments',{},manager,403);
  await request('POST','/api/restaurant',{name:urban.name,upiId:'obsolete@upi'},manager,400);
  await request('POST','/api/restaurant',{name:urban.name,id:otherId},manager,400);
  await request('PUT',`/api/super-admin/restaurants/${urban.id}`,{id:otherId},platform,400);
  await request('PUT',`/api/super-admin/restaurants/${urban.id}`,{upiId:'obsolete@upi'},platform,400);
  const after = (await request('GET','/api/super-admin/restaurants',undefined,platform)).data;
  assert.deepEqual(after,before,'Retired endpoints and invalid identity updates must not alter restaurant records');
  const guest = (await request('GET',`/api/restaurant/public/${urban.id}`)).data;
  assert.ok(!('upiId' in guest) && !('upiQrCodeUrl' in guest));
  assert.equal((await request('GET',`/api/menu-items/public/${urban.id}`)).data.length,70);
  checks.push('Retired payment/subscription/UPI routes reject actions; RBAC remains enforced.');
  checks.push('Restaurant identifiers and payment profile fields cannot be changed; existing records remain identical.');
  checks.push('Public profile omits payment details; all 70 Urban menu items remain available.');
  fs.writeFileSync(`data/${origin.startsWith('https') ? 'live' : 'local'}-internal-mode-verification.json`,JSON.stringify({verifiedAt:new Date().toISOString(),origin,checks,menuUrls:[permanentMenuUrl(urban.id)]},null,2));
  console.log('PASS: internal restaurant management, disabled billing, immutable menu identities, and preserved menu data.');
} finally {
  for (const cookie of sessions) await request('POST','/api/logout',{},cookie);
}

