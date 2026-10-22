import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='assets/urban-menu-photos';
const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
assert.equal(manifest.records.length,70);
assert.equal(new Set(manifest.records.map(r=>r.itemId)).size,70);
let bytes=0;
for(const record of manifest.records){
 const file=path.resolve(record.webp);
 assert.equal(path.dirname(file),path.resolve(folder),'Photo must stay in the canonical asset directory');
 const content=await fs.readFile(file);
 assert.equal(content.toString('ascii',0,4),'RIFF');
 assert.equal(content.toString('ascii',8,12),'WEBP');
 assert.equal(content.length,record.deliveryBytes);
 assert.equal(createHash('sha256').update(content).digest('hex'),record.deliverySha256);
 bytes+=content.length;
}
console.log(`PASS: all 70 canonical WebP images match their recorded hashes and sizes (${bytes} bytes).`);
