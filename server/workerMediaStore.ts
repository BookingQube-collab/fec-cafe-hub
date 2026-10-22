import type { Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { eq } from 'drizzle-orm';
import { mediaObjects } from '@shared/schema';
import { workerContext } from './workerContext';
import type { StoredMedia } from './mediaStore';

function storageRequest(path: string, options: RequestInit = {}) {
  const { env } = workerContext();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  return fetch(`${env.SUPABASE_URL}/storage/v1/${path}`, { ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
}
function objectPath(id: string) {
  return `${encodeURIComponent(workerContext().env.STORAGE_BUCKET)}/${id}`;
}
export async function putMedia(id: string, body: Buffer, owner: string, mime: string) {
  const response = await storageRequest(`object/${objectPath(id)}`, {
    method: 'POST', body: new Uint8Array(body), headers: { 'Content-Type': mime, 'x-upsert': 'false', 'Cache-Control': '3600' },
  });
  if (response.status === 409 || response.status === 400 && (await response.clone().text()).includes('Duplicate')) throw Object.assign(new Error('Upload already exists'), { code: 'EEXIST' });
  if (!response.ok) throw new Error('Media upload unavailable');
  try { await workerContext().db.insert(mediaObjects).values({ id, ownerId: owner, mime, size: body.length }); }
  catch (error) { await deleteStorageObject(id); throw error; }
}
export async function getMedia(id: string): Promise<StoredMedia> {
  const [meta] = await workerContext().db.select().from(mediaObjects).where(eq(mediaObjects.id, id));
  if (!meta) throw Object.assign(new Error('Media not found'), { status: 404 });
  return { id, owner: meta.ownerId, mime: meta.mime };
}
export async function copyMedia(source: StoredMedia, id: string, owner: string) {
  const { env, db } = workerContext();
  const response = await storageRequest('object/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: env.STORAGE_BUCKET, sourceKey: source.id, destinationKey: id }) });
  if (!response.ok) throw new Error('Unable to copy menu photo');
  try {
    const [meta] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, source.id));
    if (!meta) throw new Error('Source photo not found');
    await db.insert(mediaObjects).values({ id, ownerId: owner, mime: source.mime, size: meta.size });
  } catch (error) { await deleteStorageObject(id); throw error; }
}
async function deleteStorageObject(id: string) {
  const response = await storageRequest(`object/${encodeURIComponent(workerContext().env.STORAGE_BUCKET)}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [id] }),
  });
  if (!response.ok) throw new Error('Unable to remove photo');
}
export async function removeMedia(id: string) {
  await deleteStorageObject(id);
  await workerContext().db.delete(mediaObjects).where(eq(mediaObjects.id, id));
}
export async function sendMedia(file: StoredMedia, res: Response) {
  const range = res.req.get('Range');
  const response = await storageRequest(`object/authenticated/${objectPath(file.id)}`, { headers: range ? { Range: range } : {} });
  if (![200,206,304,416].includes(response.status)) throw Object.assign(new Error('Photo unavailable'), { status: response.status === 404 ? 404 : 503 });
  res.status(response.status);
  res.set({ 'Content-Type': file.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes' });
  for (const name of ['Content-Length','Content-Range','ETag','Last-Modified']) { const value = response.headers.get(name); if (value) res.set(name, value); }
  if (!response.body || res.req.method === 'HEAD') { await response.body?.cancel(); res.end(); return; }
  await pipeline(Readable.fromWeb(response.body as any), res);
}
