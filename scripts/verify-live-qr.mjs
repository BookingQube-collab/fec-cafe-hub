import fs from 'node:fs';
import { inflateSync } from 'node:zlib';
import jsQR from '../data/qr-verification-tools/node_modules/jsqr/dist/jsQR.js';
// jsqr is a temporary verification dependency, not shipped to the application.
const png=fs.readFileSync('URBAN-LIVE-QR.png');
let width,height,offset=8,compressed=[];
while(offset<png.length){const length=png.readUInt32BE(offset),kind=png.subarray(offset+4,offset+8).toString(),body=png.subarray(offset+8,offset+8+length);if(kind==='IHDR'){width=body.readUInt32BE();height=body.readUInt32BE(4);}if(kind==='IDAT')compressed.push(body);offset+=length+12;}
const scanlines=inflateSync(Buffer.concat(compressed)),rgba=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++){if(scanlines[y*(width*4+1)]!==0)throw new Error('Unexpected PNG filter');rgba.set(scanlines.subarray(y*(width*4+1)+1,(y+1)*(width*4+1)),y*width*4);}
const result=jsQR(rgba,width,height);
const metadata=JSON.parse(fs.readFileSync('data/published-qr.json','utf8'));
if(result?.data!==metadata.url)throw new Error('QR decode differs from the published menu URL');
fs.writeFileSync('data/qr-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),url:result.data,width,height,decoder:'jsQR'},null,2));
console.log('PASS: independent QR decoder confirms the published Urban menu URL.');
