// Disposable, isolated browser-audit server. Never opens the development or cloud DB.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import bcrypt from 'bcryptjs';

const appRoot = process.cwd();
const auditRoot = path.resolve('data/ui-audit');
const directory = path.join(auditRoot, randomUUID());
if (!directory.startsWith(auditRoot + path.sep)) throw new Error('Invalid audit path');
await fs.mkdir(directory, { recursive: true });
await fs.cp(path.join(appRoot,'migrations'),path.join(directory,'migrations'),{recursive:true});
await fs.mkdir(path.join(directory,'dist'),{recursive:true});
await fs.cp(path.join(appRoot,'dist/public'),path.join(directory,'dist/public'),{recursive:true});
const db = await PGlite.create(path.join(directory,'database'));
await migrate(drizzle(db),{migrationsFolder:path.join(directory,'migrations')});
const password = randomBytes(20).toString('hex');
const hash = await bcrypt.hash(password,12);
const platform = randomUUID(), manager = randomUUID(), other = randomUUID();
const cafe = randomUUID(), destination = randomUUID();
for (const [id,email,role,name] of [[platform,'audit-platform@test.cafe','super_admin','Audit Platform'],[manager,'audit-manager@test.cafe','admin','Audit Manager'],[other,'audit-other@test.cafe','admin','Audit Other']]) {
  await db.query('INSERT INTO users(id,email,password,role,first_name) VALUES ($1,$2,$3,$4,$5)',[id,email,hash,role,name]);
}
for (const [id,owner,name,theme] of [[cafe,manager,'UI Audit Café','plum'],[destination,other,'UI Audit Destination','terracotta']]) {
  await db.query("INSERT INTO restaurants(id,user_id,name,theme,currency,timezone) VALUES ($1,$2,$3,$4,'QAR','Asia/Qatar')",[id,owner,name,theme]);
}
const source = JSON.parse(await fs.readFile('test-data/urban-menu.json','utf8'));
const photos = JSON.parse(await fs.readFile('test-data/library-source-before.json','utf8')).items;
const mediaRoot = path.join(directory,'data/uploads');
await fs.mkdir(mediaRoot,{recursive:true});
let itemCount=0;
for (const [order,category] of source.categories.entries()) {
  const categoryId=randomUUID();
  await db.query('INSERT INTO categories(id,restaurant_id,title,"order") VALUES ($1,$2,$3,$4)',[categoryId,cafe,category.title,order]);
  for (const [itemOrder,[name,price,options]] of category.items.entries()) {
    const id=randomUUID(), photo=photos.find(i=>i.name===name)?.imageUrl;
    let imageUrl=null;
    if (photo && /^\/objects\/[a-f0-9-]{36}$/.test(photo)) {
      const mediaId=photo.split('/').pop();
      try {
        const metadata=JSON.parse(await fs.readFile(path.join(appRoot,'data/uploads',mediaId+'.json'),'utf8'));
        await fs.copyFile(path.join(appRoot,'data/uploads',mediaId),path.join(mediaRoot,mediaId));
        await fs.writeFile(path.join(mediaRoot,mediaId+'.json'),JSON.stringify({...metadata,owner:manager}));
        imageUrl=photo;
      } catch { /* Optional photo; UI also exercises the fallback. */ }
    }
    await db.query('INSERT INTO menu_items(id,category_id,name,price,unit,image_url,is_available,has_multiple_pricing,"order") VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)',[id,categoryId,name,price,'serving',imageUrl,!!options,itemOrder]);
    for (const [optionOrder,option] of (options||[]).entries()) await db.query('INSERT INTO menu_item_price_variants(id,menu_item_id,label,price,unit,"order") VALUES ($1,$2,$3,$4,$5,$6)',[randomUUID(),id,option.label,option.price,'cup',optionOrder]);
    itemCount++;
  }
}
await db.close();
const credentials={origin:'http://127.0.0.1:5102',password,platformEmail:'audit-platform@test.cafe',managerEmail:'audit-manager@test.cafe',otherEmail:'audit-other@test.cafe',cafeId:cafe,destinationId:destination};
const stateFile=path.join(appRoot,'data/ui-audit-private.json');
await fs.writeFile(stateFile,JSON.stringify(credentials),{mode:0o600});
const child=spawn(process.execPath,[path.join(appRoot,'dist/index.js')],{cwd:directory,env:{...process.env,NODE_ENV:'production',PORT:'5102',DATA_DIR:path.join(directory,'database'),SESSION_SECRET:randomBytes(48).toString('hex'),CAFE_RUNTIME:'local',COOKIE_SECURE:'false'},windowsHide:true,stdio:['ignore','ignore','pipe']});
let errors='';child.stderr.on('data',b=>{errors+=b.toString();});
let stopping=false;
async function stop(){
  if(stopping)return;stopping=true;
  child.kill('SIGTERM');
  await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});
  if(!directory.startsWith(auditRoot+path.sep))throw new Error('Invalid cleanup path');
  await fs.rm(directory,{recursive:true,force:true});
  await fs.rm(stateFile,{force:true});
  console.log('Isolated UI audit stopped; temporary database, media and credentials removed.');
  process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
process.stdin.on('data',b=>{if(b.toString().trim()==='stop')void stop();});
for(let attempt=0;attempt<80;attempt++){
  try {if((await fetch(credentials.origin+'/api/cafes')).ok)break;}catch{}
  if(attempt===79){console.error(errors||'Audit server did not start');await stop();}
  await new Promise(resolve=>setTimeout(resolve,200));
}
const signed=await fetch(credentials.origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:credentials.managerEmail,password})});
if(!signed.ok)throw new Error('Audit manager login failed');
const cookie=signed.headers.get('set-cookie').split(';')[0];
const menu=await (await fetch(credentials.origin+'/api/manager-menu',{headers:{Cookie:cookie}})).json();
for(const item of menu.items){
  const r=await fetch(credentials.origin+'/api/menu-library/publish',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({restaurantId:cafe,itemIds:[item.id]})});
  if(!r.ok)throw new Error('Audit library seeding failed');
}
await fetch(credentials.origin+'/api/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});
console.log(`Isolated UI audit ready at ${credentials.origin}: ${itemCount} sample items, two cafés, three temporary accounts. Type stop to clean up.`);
