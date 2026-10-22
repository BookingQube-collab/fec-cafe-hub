import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';
let localSecrets={};
try { localSecrets=parse(await fs.readFile('.env.cloud','utf8')); }
catch(error) { if(error.code!=='ENOENT') throw error; }
const cloud={...process.env,...localSecrets};
const names=['SESSION_SECRET','PASSWORD_SERVICE_SECRET','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','SUPABASE_ACCESS_TOKEN','CLOUDFLARE_API_TOKEN'];
const secrets=names.filter(name=>cloud[name]?.length>=24).map(name=>({name,value:cloud[name]}));
let files=0;
async function inspect(directory) {
  for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) {await inspect(file);continue;}
    assert.ok(!/\.map$|\.env|credentials|backup|snapshot/i.test(entry.name),'Private/build-only file must not enter public assets: '+entry.name);
    const bytes=await fs.readFile(file);files++;
    for(const {name,value} of secrets) assert.ok(!bytes.includes(Buffer.from(value)),name+' must not appear in public assets');
  }
}
await inspect('dist/public');
const ignores=await fs.readFile('.gitignore','utf8');
for(const rule of ['.env','data/','*CREDENTIALS*.txt','*credentials*.json','.wrangler/']) assert.ok(ignores.split(/\r?\n/).includes(rule),'Missing private-file exclusion: '+rule);
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/hardening-artifact-verification.json',JSON.stringify({at:new Date().toISOString(),publicFilesChecked:files,privateValuesAbsent:true,credentialExclusionsPresent:true},null,2));
console.log(`PASS: ${files} public assets contain no configured private credential values, source maps or private files; credential exclusions are present.`);
