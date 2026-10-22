import fs from 'node:fs';
import assert from 'node:assert/strict';
import { MANAGEMENT_ORIGIN, PUBLIC_MENU_ORIGIN, permanentMenuUrl } from '../shared/menuIdentity';
const urbanId = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';
const sessions: string[] = [];
async function request(origin: string, path: string, method = 'GET', body?: unknown, cookie = '', expected = 200) {
  const r = await fetch(origin + path, { method, redirect:'manual', headers: { Origin:origin, 'Content-Type':'application/json', Cookie:cookie }, ...(body === undefined ? {} : { body:JSON.stringify(body) }), signal:AbortSignal.timeout(45000) });
  const text = await r.text(); let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  assert.equal(r.status, expected, `${origin}${path}: ${r.status}`);
  return { data, headers:r.headers, cookie:r.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function login(email: string, file: string) {
  const saved = fs.readFileSync(file,'utf8');
  const password = saved.slice(saved.indexOf(`Email: ${email}`)).match(/Password: (.+)/)![1];
  const result = await request(MANAGEMENT_ORIGIN,'/api/login','POST',{ email,password });
  assert.ok(result.cookie); assert.ok(result.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok(result.cookie.startsWith('__Host-cafe.sid='));
  assert.ok(result.headers.get('set-cookie')?.includes('Path=/'));
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.ok(result.headers.get('set-cookie')?.includes('Secure'));
  assert.ok(!result.headers.get('set-cookie')?.toLowerCase().includes('domain='));
  sessions.push(result.cookie); return result.cookie;
}
try {
  const signInPage=await request(MANAGEMENT_ORIGIN,'/login');
  assert.equal(signInPage.headers.get('cache-control'),'no-store');
  assert.equal(signInPage.headers.get('strict-transport-security'),'max-age=31536000');
  assert.ok(signInPage.headers.get('content-security-policy')?.includes("object-src 'none'"));
  await request(MANAGEMENT_ORIGIN,'/api/auth/user','GET',undefined,'',401);
  const platform = await login('platform@cafe.local','SETUP-CREDENTIALS.txt');
  const manager = await login('manager@urban.cafe','URBAN-CAFE-CREDENTIALS.txt');
  const siblingMutation=await fetch(MANAGEMENT_ORIGIN+'/api/logout',{method:'POST',headers:{Cookie:manager,'Content-Type':'application/json','Sec-Fetch-Site':'same-site'},body:'{}',signal:AbortSignal.timeout(45000)});
  assert.equal(siblingMutation.status,403);await siblingMutation.body?.cancel();
  await request(MANAGEMENT_ORIGIN,'/api/auth/user','GET',undefined,manager.replace('__Host-cafe.sid=','connect.sid='),401);
  for (const email of ['manager@inflata.cafe','manager@drivethrough.cafe']) {
    const cookie = await login(email,'NEW-CAFE-CREDENTIALS.txt');
    assert.equal((await request(MANAGEMENT_ORIGIN,'/api/auth/user','GET',undefined,cookie)).data.role,'admin');
    assert.ok((await request(MANAGEMENT_ORIGIN,'/api/restaurant','GET',undefined,cookie)).data.id);
  }
  const users = (await request(MANAGEMENT_ORIGIN,'/api/super-admin/users','GET',undefined,platform)).data;
  assert.equal(users.length,4); assert.ok(users.every((u:any) => u.accountStatus === 'active' && !('password' in u)));
  const cafes = (await request(MANAGEMENT_ORIGIN,'/api/super-admin/restaurants','GET',undefined,platform)).data;
  assert.equal(cafes.length,3);
  const menu = (await request(MANAGEMENT_ORIGIN,'/api/manager-menu','GET',undefined,manager)).data;
  assert.equal(menu.restaurant.id,urbanId); assert.equal(menu.items.length,70); assert.equal(menu.categories.length,16);
  await request(MANAGEMENT_ORIGIN,'/api/super-admin/users','GET',undefined,manager,403);
  assert.equal(permanentMenuUrl(urbanId),PUBLIC_MENU_ORIGIN+'/menu/'+urbanId);
  if (!process.argv.includes('--staff-only')) {
    for (const path of ['/login','/admin','/admin/menu','/super-admin','/super-admin/accounts','/register','/%61dmin']) {
      const denied = await request(PUBLIC_MENU_ORIGIN,path,'GET',undefined,platform,404);
      assert.ok(denied.data.includes('Customer menus only.')); assert.equal(denied.headers.get('cache-control'),'no-store');
      assert.equal(denied.cookie,'');
    }
    for (const path of ['/api/auth/user','/api/restaurant','/api/manager-menu','/api/menu-library','/api/super-admin/users']) await request(PUBLIC_MENU_ORIGIN,path,'GET',undefined,platform,404);
    await request(PUBLIC_MENU_ORIGIN,'/api/login','POST',{},'',404);
    await request(PUBLIC_MENU_ORIGIN,'/api/objects/upload','POST',{},platform,404);
    for (const method of ['POST','PUT','PATCH','DELETE']) await request(PUBLIC_MENU_ORIGIN,'/api/menu-items/public/'+urbanId,method,{},platform,404);
    const guestPage=await request(PUBLIC_MENU_ORIGIN,'/menu/'+urbanId);
    assert.equal(guestPage.headers.get('cache-control'),'no-store');
    assert.equal(guestPage.headers.get('strict-transport-security'),'max-age=31536000');
    assert.equal(guestPage.headers.get('cross-origin-opener-policy'),'same-origin');
    assert.ok(guestPage.headers.get('content-security-policy')?.includes("object-src 'none'"));
    for(const cafe of cafes) await request(PUBLIC_MENU_ORIGIN,'/api/menu/public/'+cafe.id);
    const publicItems = (await request(PUBLIC_MENU_ORIGIN,'/api/menu-items/public/'+urbanId)).data;
    assert.ok(publicItems.length <= menu.items.length);
    assert.ok(publicItems.every((i:any) => i.isAvailable && menu.items.some((m:any) => m.id === i.id)));
    assert.equal((await request(PUBLIC_MENU_ORIGIN,'/api/categories/public/'+urbanId)).data.length,16);
    const bundle = (await request(PUBLIC_MENU_ORIGIN,'/api/menu/public/'+urbanId)).data;
    assert.equal(bundle.restaurant.id,urbanId);
    assert.ok(!('userId' in bundle.restaurant) && !('upiId' in bundle.restaurant));
    assert.equal(bundle.categories.length,16);
    assert.ok(bundle.items.every((i:any) => i.isAvailable && bundle.categories.some((c:any) => c.id === i.categoryId)));
    assert.ok(bundle.variants.every((v:any) => bundle.items.some((i:any) => i.id === v.menuItemId)));
    await request(PUBLIC_MENU_ORIGIN,'/api/menu/public/'+urbanId,'HEAD',undefined,platform);
    for (const method of ['POST','PUT','PATCH','DELETE']) await request(PUBLIC_MENU_ORIGIN,'/api/menu/public/'+urbanId,method,{},platform,404);
    const image = await request(PUBLIC_MENU_ORIGIN,menu.restaurant.logoUrl); assert.match(image.headers.get('content-type') || '',/^image\//);
    const photo = publicItems.find((i:any) => i.imageUrl); await request(PUBLIC_MENU_ORIGIN,photo.imageUrl);
    assert.equal((await request(MANAGEMENT_ORIGIN,'/api/auth/user','GET',undefined,platform)).data.role,'super_admin');
    fs.writeFileSync('data/menu-isolation-verification.json',JSON.stringify({at:new Date().toISOString(),publicOrigin:PUBLIC_MENU_ORIGIN,staffOrigin:MANAGEMENT_ORIGIN,qrUrl:permanentMenuUrl(urbanId),urbanItems:menu.items.length,visibleItems:bundle.items.length,categories:bundle.categories.length,priceVariants:bundle.variants.length,publicBundleVerified:true,accounts:4,cafes:3,staffLoginVerified:true,publicStaffRoutesBlocked:true,validSessionReplayBlocked:true,publicMutationsBlocked:true},null,2));
  }
  console.log('PASS: hardened headers/cookies, sibling-origin rejection, staff sign-in/RBAC, four accounts, three cafés and Urban 70-item menu preserved.' + (process.argv.includes('--staff-only') ? '' : ' Public QR rejects staff pages, login, cookie replay and mutations; all three public menus, existing photos and QR work.'));
} finally { for (const cookie of sessions) await request(MANAGEMENT_ORIGIN,'/api/logout','POST',{},cookie); }
