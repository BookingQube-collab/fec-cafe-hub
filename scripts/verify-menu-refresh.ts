import assert from 'node:assert/strict';
import { getMenuData, keepMenuDuringReconnect, MenuLoadError } from '../client/src/lib/menuRefresh';

const now = Date.now();
for (const status of [0, 429, 500, 502, 503]) assert.ok(keepMenuDuringReconnect(new MenuLoadError(status), now - 5000, now));
for (const status of [400, 401, 403, 404]) assert.equal(keepMenuDuringReconnect(new MenuLoadError(status), now - 5000, now), false);
assert.equal(keepMenuDuringReconnect(new MenuLoadError(503), now - 30000, now), false);
assert.equal(keepMenuDuringReconnect(new MenuLoadError(503), 0, now), false);
assert.equal(keepMenuDuringReconnect(new SyntaxError('Invalid response'), now - 5000, now), false);

const original = globalThis.fetch;
try {
  const controller = new AbortController();
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.signal, controller.signal);
    return new Response('', { status: 404 });
  };
  await assert.rejects(getMenuData('/api/menu/public/test', controller.signal), error => error instanceof MenuLoadError && error.status === 404);
  globalThis.fetch = async () => { throw new TypeError('Network failed'); };
  await assert.rejects(getMenuData('/api/menu/public/test', controller.signal), error => error instanceof MenuLoadError && error.status === 0);
  controller.abort();
  await assert.rejects(getMenuData('/api/menu/public/test', controller.signal), TypeError);
} finally { globalThis.fetch = original; }
console.log('PASS: brief reconnect retention; access revocation, initial/expired/invalid responses fail closed; credentials omitted and cancellation preserved.');
