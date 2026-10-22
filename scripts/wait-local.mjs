import { setTimeout } from 'node:timers/promises';
const port = Number(process.argv[2] || 5100);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid café port');
let ready = false;
const deadline = Date.now() + 15000;
while (Date.now() < deadline) {
  try { const res = await fetch(`http://localhost:${port}/api/cafes`,{signal:AbortSignal.timeout(1500)}); if(res.ok){ready=true;break;} } catch {}
  await setTimeout(250);
}
if (!ready) throw new Error('Cafe API did not become ready. Check data/server-error.log.');
console.log('Cafe API is ready.');
