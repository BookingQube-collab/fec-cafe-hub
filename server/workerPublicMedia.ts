import type { Client } from 'pg';
import type { ExecutionContext } from '@cloudflare/workers-types';
import type { WorkerEnvironment } from './workerContext';

// These UUID photo URLs already support public GETs. Keep uploads/ownership
// mutations in Express; stream reads natively to avoid Node stream CPU overhead.
export function publicMediaId(request: Request) {
  return ['GET','HEAD'].includes(request.method) ? new URL(request.url).pathname.match(/^\/objects\/([a-f0-9-]{36})$/)?.[1] : undefined;
}
function photoCache() { return (caches as unknown as { default: Cache }).default; }
function cacheKey(request: Request) { return new Request(new URL(request.url).origin + new URL(request.url).pathname); }
export async function cachedPublicMedia(request: Request) {
  if (request.headers.has('Range')) return undefined;
  const cached = await photoCache().match(cacheKey(request));
  if (!cached) return undefined;
  return new Response(request.method === 'HEAD' ? null : cached.body, cached);
}
export async function streamPublicMedia(request: Request, id: string, client: Client, env: WorkerEnvironment, ctx: ExecutionContext) {
  const { rows } = await client.query('SELECT mime FROM media_objects WHERE id=$1',[id]);
  if (!rows.length) return Response.json({ message:'Media not found' },{status:404,headers:{'Cache-Control':'no-store'}});
  const headers = new Headers({ Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,apikey:env.SUPABASE_SERVICE_ROLE_KEY });
  const range = request.headers.get('Range'); if (range) headers.set('Range',range);
  const upstream = await fetch(`${env.SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(env.STORAGE_BUCKET)}/${id}`,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if (![200,206,304,416].includes(upstream.status)) { await upstream.body?.cancel(); return Response.json({message:'Photo unavailable'},{status:upstream.status===404?404:503,headers:{'Cache-Control':'no-store'}}); }
  const outgoing = new Headers({ 'Content-Type':rows[0].mime,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Accept-Ranges':'bytes' });
  for (const name of ['Content-Length','Content-Range','ETag','Last-Modified']) { const value=upstream.headers.get(name); if(value) outgoing.set(name,value); }
  const response = new Response(upstream.body,{status:upstream.status,headers:outgoing});
  if(request.method==='GET' && !range && upstream.status===200) ctx.waitUntil(photoCache().put(cacheKey(request),response.clone()).catch(()=>{}));
  return response;
}
