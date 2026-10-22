import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=JSON.parse(fs.readFileSync('fixtures/urban-menu.json','utf8'));
const base=process.env.CAFE_APP_URL||'http://localhost:5100';
let cookie='';
async function request(method,url,body){const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!res.ok)throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);const data=await res.json();return {data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
const credentialsFile='URBAN-CAFE-CREDENTIALS.txt';
const email='manager@urban.cafe';
assert.ok(fs.existsSync(credentialsFile),'Create the Urban manager in the super-admin dashboard and save its private credentials before importing.');
const password=fs.readFileSync(credentialsFile,'utf8').match(/Password: (.+)/)?.[1];
assert.ok(password,'The private Urban manager credential file must contain its password.');
cookie=(await request('POST','/api/login',{email,password})).cookie;
const cafe=(await request('GET','/api/restaurant')).data;
const existing=(await request('GET','/api/menu-items')).data;
const records=[];
if(existing.length){console.log('Urban menu already contains items; preserving existing menu and profile.');}else{
 await request('POST','/api/restaurant',{name:source.cafeName,cuisineType:'Pizza · Coffee · Snacks · Refreshments',theme:source.theme,currency:source.currency,timezone:source.timezone});
 for(const [order,category] of source.categories.entries()){
  const cat=(await request('POST','/api/categories',{restaurantId:cafe.id,title:category.title,order})).data;
  for(const [itemOrder,[name,price,options]] of category.items.entries()){
   const item=(await request('POST','/api/menu-items',{categoryId:cat.id,name,price,discount:0,unit:order>=8?'cup':'serving',isAvailable:true,hasMultiplePricing:!!options,tags:[],specialDate:null,order:itemOrder})).data;
   if(options)await request('POST','/api/menu-items/'+item.id+'/price-variants',options.map((option,index)=>({...option,discount:0,unit:'cup',order:index})));
   records.push({id:item.id,category:category.title,name,price,options:options||[]});
  }
 }
}
const cats=(await request('GET','/api/categories')).data;
const items=(await request('GET','/api/menu-items/public/'+cafe.id)).data;
const options=(await request('GET','/api/price-variants/public/restaurant/'+cafe.id)).data;
assert.equal(cats.length,16);assert.equal(items.length,70);assert.equal(options.length,4);
for(const category of source.categories){const cat=cats.find(c=>c.title===category.title);assert.ok(cat);for(const [name,price,variants] of category.items){const item=items.find(i=>i.categoryId===cat.id&&i.name===name);assert.ok(item,name);assert.equal(Number(item.price),price,name);assert.equal(Number(item.discount),0);assert.equal(item.specialDate,null);if(variants)for(const variant of variants)assert.ok(options.some(o=>o.menuItemId===item.id&&o.label===variant.label&&Number(o.price)===variant.price));}}
const verifiedRecords=items.map(item=>({id:item.id,category:cats.find(c=>c.id===item.categoryId)?.title,name:item.name,price:Number(item.price),options:options.filter(o=>o.menuItemId===item.id).map(o=>({label:o.label,price:Number(o.price)}))}));
fs.writeFileSync('test-data/urban-import.json',JSON.stringify({cafeId:cafe.id,menuUrl:base+'/menu/'+cafe.id,importedAt:new Date().toISOString(),source:source.source,itemCount:items.length,categoryCount:cats.length,priceVariantCount:options.length,records:verifiedRecords},null,2)+'\n');
console.log(`PASS: ${items.length} items in ${cats.length} categories; source prices and four price options verified.\nOpen ${base}/menu/${cafe.id}`);
