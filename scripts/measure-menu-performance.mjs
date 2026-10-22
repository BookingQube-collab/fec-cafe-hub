import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const label = process.argv[2] || 'before';
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
const saved = fs.readFileSync('URBAN-CAFE-CREDENTIALS.txt', 'utf8');
const email = saved.match(/Email: (.+)/)[1].trim();
const password = saved.match(/Password: (.+)/)[1].trim();
const id = 'fe7f873f-acd2-483b-8258-a06528a2a8f7';
const results = [];
for (const origin of [process.env.PUBLIC_URL || 'http://localhost:5100'].filter((v,i,a)=>a.indexOf(v)===i)) {
  const response = await fetch(origin + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Sign-in failed (${response.status})`);
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  await response.arrayBuffer();
  const measure = async (name, paths, publicOrigin = origin) => {
    const samples = [];
    for (let n = 0; n < 5; n++) {
      const start = performance.now();
      await Promise.all(paths.map(async path => {
        const res = await fetch(publicOrigin + path, { headers: publicOrigin === origin ? { Cookie: cookie } : {} });
        if (!res.ok) throw new Error(`${name} failed (${res.status})`);
        await res.arrayBuffer();
      }));
      samples.push(Math.round(performance.now() - start));
    }
    const ordered = [...samples].sort((a, b) => a - b);
    results.push({ origin, name, requests: paths.length, medianMs: ordered[2], samplesMs: samples });
  };
  try {
    await measure('manager-menu', ['/api/manager-menu']);
    await measure('menu-edit-refresh', ['/api/manager-menu', '/api/restaurant']);
    const publicOrigin = process.env.PUBLIC_MENU_ORIGIN || origin;
    await measure('public-menu-four-requests', [`/api/restaurant/public/${id}`, `/api/categories/public/${id}`, `/api/menu-items/public/${id}`, `/api/price-variants/public/restaurant/${id}`], publicOrigin);
    if (label === 'after') await measure('public-menu-bundle', [`/api/menu/public/${id}`], publicOrigin);
  } finally {
    await fetch(origin + '/api/logout', { method: 'POST', headers: { Cookie: cookie } });
  }
}
fs.writeFileSync(`test-data/performance-${label}.json`, JSON.stringify({ label, results }, null, 2) + '\n');
console.log(JSON.stringify(results.map(({ origin, name, requests, medianMs }) => ({ origin, name, requests, medianMs })), null, 2));
