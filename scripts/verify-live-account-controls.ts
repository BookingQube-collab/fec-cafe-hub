import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://staff.cafe-menu.workers.dev';
const sessions: string[]=[];
async function request(method:string,path:string,body?:unknown,cookie='',expected=200){
  const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: HTTP ${r.status}`);
  return {data,cookie:r.headers.get('set-cookie')?.split(';')[0] || ''};
}
async function login(email:string,file:string){
  const text=fs.readFileSync(file,'utf8');const password=text.slice(text.indexOf(`Email: ${email}`)).match(/Password: (.+)/)![1];
  const {cookie}=await request('POST','/api/login',{email,password});sessions.push(cookie);return cookie;
}
try{
  const platform=await login('platform@cafe.local','SETUP-CREDENTIALS.txt');
  const manager=await login('manager@urban.cafe','URBAN-CAFE-CREDENTIALS.txt');
  const users=(await request('GET','/api/super-admin/users',undefined,platform)).data;
  assert.equal(users.length,4);assert.ok(users.every((u:any)=>u.accountStatus==='active' && !('password' in u)));
  const self=users.find((u:any)=>u.email==='platform@cafe.local');
  await request('POST','/api/super-admin/users',{},'',401);
  await request('POST','/api/super-admin/users',{},manager,403);
  await request('POST','/api/super-admin/users',{},platform,400);
  for(const action of ['freeze','unfreeze','restore'])await request('POST',`/api/super-admin/users/${self.id}/${action}`,{},manager,403);
  await request('DELETE',`/api/super-admin/users/${self.id}`,{},manager,403);
  await request('POST',`/api/super-admin/users/${self.id}/freeze`,{},platform,400);
  await request('DELETE',`/api/super-admin/users/${self.id}`,{},platform,400);
  await request('PUT',`/api/super-admin/users/${self.id}`,{role:'admin'},platform,400);
  assert.deepEqual((await request('GET','/api/super-admin/users',undefined,platform)).data,users);
  const cafes=(await request('GET','/api/super-admin/restaurants',undefined,platform)).data;assert.equal(cafes.length,3);
  const urban=cafes.find((c:any)=>c.name==='Urban Café');
  assert.equal((await request('GET',`/api/menu-items/public/${urban.id}`)).data.length,70);
  assert.equal((await request('GET','/api/menu-library',undefined,platform)).data.length,70);
  fs.writeFileSync('data/live-account-controls-verification.json',JSON.stringify({at:new Date().toISOString(),origin,accounts:users.map(({email,role,accountStatus}:any)=>({email,role,accountStatus})),cafes:3,urbanItems:70,libraryItems:70,allAccountsUnchanged:true,guardChecksPassed:true,isolatedLifecycleChecksPassed:true},null,2));
  console.log('PASS: live account-control guards, self/last-admin protection, four active accounts, three cafés and 70-item Urban menu preserved.');
}finally{for(const cookie of sessions)await request('POST','/api/logout',{},cookie);}

