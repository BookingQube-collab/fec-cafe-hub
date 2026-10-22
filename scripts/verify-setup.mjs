import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

const root=path.resolve('data/setup-verification');
const directory=path.resolve(root,randomUUID());
assert.ok(directory.startsWith(root+path.sep));
await fs.mkdir(directory,{recursive:true});
const environment={...process.env,DATA_DIR:path.join(directory,'database'),TSX_TSCONFIG_PATH:path.resolve('tsconfig.json')};
// setup reads migrations relative to its working directory.
await fs.cp('migrations',path.join(directory,'migrations'),{recursive:true});
const run=()=>execFileSync(process.execPath,['--import','tsx',path.resolve('scripts/setup.ts')],{cwd:directory,env:environment,windowsHide:true,stdio:'pipe'});
async function state(){
 const db=new PGlite(environment.DATA_DIR);
 try{return {users:(await db.query('SELECT id,email,role,password FROM users ORDER BY id')).rows,cafes:(await db.query('SELECT id FROM restaurants')).rows};}finally{await db.close();}
}
try{
 run();const before=await state();
 assert.equal(before.users.length,1);assert.equal(before.users[0].role,'super_admin');assert.equal(before.users[0].email,'platform@cafe.local');assert.equal(before.cafes.length,0);
 const credentials=await fs.readFile(path.join(directory,'SETUP-CREDENTIALS.txt'),'utf8');
 assert.ok(!credentials.includes('admin@e3.cafe'));
 run();assert.deepEqual(await state(),before,'Repeated setup must preserve existing account identity and password');
 assert.equal(await fs.readFile(path.join(directory,'SETUP-CREDENTIALS.txt'),'utf8'),credentials);
 console.log('PASS: fresh setup creates only the platform administrator, no test cafés; reruns preserve account identity, password and credential file.');
}finally{
 assert.ok(directory.startsWith(root+path.sep));
 await fs.rm(directory,{recursive:true,force:true});
}
