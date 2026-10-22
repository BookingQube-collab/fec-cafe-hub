// Enforced before static SPA fallback and before sessions/DB access.
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const menuPage = new RegExp(`^/menu/${uuid}/?$`, 'i');
const publicApi = new RegExp(`^/api/(?:(?:menu|restaurant|categories|menu-items)/public/${uuid}|price-variants/public/(?:restaurant/)?${uuid})/?$`, 'i');
const photo = new RegExp(`^/objects/${uuid}$`, 'i');
export function publicMenuRequestAllowed(request: Request): boolean {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const path = new URL(request.url).pathname;
  return path === '/' || path === '/index.html' || path === '/favicon.svg' ||
    path.startsWith('/assets/') || menuPage.test(path) || photo.test(path) ||
    path === '/api/cafes' || path === '/api/health' || publicApi.test(path);
}
export function blockedPublicMenuRequest(request: Request): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  if (new URL(request.url).pathname.startsWith('/api/') || new URL(request.url).pathname.startsWith('/objects/')) {
    return Response.json({ message: 'This address serves customer menus only.' }, { status: 404, headers });
  }
  const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer menus</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#faf6f2;color:#302431;font-family:system-ui,sans-serif}main{padding:32px;max-width:380px}h1{font-size:32px;letter-spacing:-1px}p{line-height:1.6;color:#685969}a{display:inline-block;margin-top:12px;padding:14px 22px;border-radius:24px;background:#68417c;color:white;text-decoration:none}</style><main><h1>Customer menus only.</h1><p>This page isn’t available here. Explore a café or scan its menu QR.</p><a href="/">Browse cafés</a></main></html>';
  return new Response(request.method === 'HEAD' ? null : html, { status: 404, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}
