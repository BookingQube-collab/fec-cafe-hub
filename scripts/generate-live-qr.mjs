import fs from 'node:fs';
import qrGenerator from 'qrcode-generator';
import { deflateSync } from 'node:zlib';
const origin=process.env.PUBLIC_URL || process.env.PUBLIC_MENU_ORIGIN || 'http://localhost:5100';
const url=origin+'/menu/fe7f873f-acd2-483b-8258-a06528a2a8f7';
const qr=qrGenerator(0,'H'); qr.addData(url,'Byte'); qr.make();
fs.writeFileSync('URBAN-LIVE-QR.svg',qr.createSvgTag({cellSize:8,margin:32,scalable:true}));
const cells=qr.getModuleCount(),scale=8,margin=32,size=cells*scale+2*margin;
const pixels=Buffer.alloc((size*4+1)*size,255);
for(let y=0;y<size;y++){
 pixels[y*(size*4+1)]=0;
 for(let x=0;x<size;x++){
  const row=Math.floor((y-margin)/scale),col=Math.floor((x-margin)/scale);
  const black=row>=0&&col>=0&&row<cells&&col<cells&&qr.isDark(row,col);
  const offset=y*(size*4+1)+1+x*4;
  pixels[offset]=pixels[offset+1]=pixels[offset+2]=black?0:255; pixels[offset+3]=255;
 }
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,body){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([name,body])));return Buffer.concat([length,name,body,crc]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
fs.writeFileSync('URBAN-LIVE-QR.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
fs.writeFileSync('data/published-qr.json',JSON.stringify({url,modules:cells,width:size,quietZoneModules:4,errorCorrection:'H',png:'URBAN-LIVE-QR.png',svg:'URBAN-LIVE-QR.svg'},null,2));
console.log(`Published menu QR saved as PNG and SVG (${size}×${size}).`);
