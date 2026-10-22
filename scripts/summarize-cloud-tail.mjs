import fs from 'node:fs';
const bytes = fs.readFileSync('data/cloud-tail.jsonl');
const text = bytes.toString(bytes[0]===255 && bytes[1]===254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/,'');
const events = [];
let start=-1, depth=0, quoted=false, escaped=false;
for(let i=0;i<text.length;i++) {
 const c=text[i];
 if(quoted) { if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; continue; }
 if(c==='"') quoted=true;
 else if(c==='{') { if(depth++===0) start=i; }
 else if(c==='}' && --depth===0 && start>=0) { try{ events.push(JSON.parse(text.slice(start,i+1))); }catch{} start=-1; }
}
const summary=events.map(e=>({timestamp:e.eventTimestamp,version:e.scriptVersion?.id,outcome:e.outcome,cpuTime:e.cpuTime,wallTime:e.wallTime,path:e.event?.request?.url ? new URL(e.event.request.url).pathname : undefined,status:e.event?.response?.status,exceptions:(e.exceptions||[]).map(x=>x.name)}));
const versions=Array.from(new Set(summary.map(e=>e.version).filter(Boolean)));
const metrics=versions.map(version=>{
 const rows=summary.filter(e=>e.version===version),cpu=rows.map(e=>e.cpuTime).filter(n=>typeof n==='number').sort((a,b)=>a-b);
 return {version,requests:rows.length,p50Cpu:cpu[Math.floor(cpu.length*.5)],p95Cpu:cpu[Math.floor(cpu.length*.95)],maxCpu:cpu.at(-1),above10ms:cpu.filter(n=>n>10).length,exceededCpu:rows.filter(e=>e.outcome==='exceededCpu').length};
});
fs.writeFileSync('data/cloud-telemetry-summary.json',JSON.stringify({measuredAt:new Date().toISOString(),metrics,events:summary},null,2));
console.log('Latest version CPU:',JSON.stringify(metrics.at(-1)));
console.log(JSON.stringify({count:summary.length,cpuFields:summary.filter(e=>e.cpuTime!==undefined).length,outcomes:summary.reduce((a,e)=>(a[e.outcome]=(a[e.outcome]||0)+1,a),{}),latest:summary.slice(-6)},null,2));
