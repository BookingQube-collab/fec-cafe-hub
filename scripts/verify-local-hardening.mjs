import assert from 'node:assert/strict';
const base='http://localhost:5100';
const page=await fetch(base+'/login');
assert.equal(page.headers.get('cache-control'),'no-store');
assert.ok(page.headers.get('content-security-policy').includes("object-src 'none'"));
assert.equal((await fetch(base+'/api/auth/user')).status,401);
assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'[]'})).status,400);
console.log('PASS: localhost HTML cache/CSP protection, private API authentication and invalid-body rejection.');
