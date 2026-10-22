import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import { mediaObjects } from '@shared/schema';
import { db, usingRemoteDatabase } from './db';

export type StoredMedia = { id: string; owner: string; mime: string; filename?: string };

const root = path.resolve('data/uploads');
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const storageBucket = process.env.STORAGE_BUCKET || 'cafe-media';
const useSupabaseStorage = usingRemoteDatabase
  && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)
  && Boolean(serviceRole);

function storageRequest(apiPath: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${serviceRole}`);
  headers.set('apikey', serviceRole);
  return fetch(`${supabaseUrl}/storage/v1/${apiPath}`, {
    ...options,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
}

function objectPath(id: string) {
  return `${encodeURIComponent(storageBucket)}/${id}`;
}

async function deleteStorageObject(id: string) {
  const response = await storageRequest(`object/${encodeURIComponent(storageBucket)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [id] }),
  });
  if (!response.ok) throw new Error('Unable to remove photo');
}

async function putLocal(id: string, body: Buffer, owner: string, mime: string) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, id), body, { flag: 'wx' });
  try { await fs.writeFile(path.join(root, id + '.json'), JSON.stringify({ owner, mime }), { flag: 'wx' }); }
  catch (error) { await fs.unlink(path.join(root, id)); throw error; }
}

async function getLocal(id: string): Promise<StoredMedia> {
  const meta = JSON.parse(await fs.readFile(path.join(root, id + '.json'), 'utf8'));
  return { id, owner: meta.owner, mime: meta.mime, filename: path.join(root, id) };
}

async function copyLocal(source: StoredMedia, id: string, owner: string) {
  await fs.copyFile(source.filename!, path.join(root, id), 1);
  try { await fs.writeFile(path.join(root, id + '.json'), JSON.stringify({ owner, mime: source.mime }), { flag: 'wx' }); }
  catch (error) { await fs.unlink(path.join(root, id)); throw error; }
}

async function removeLocal(id: string) {
  await Promise.allSettled([fs.unlink(path.join(root, id)), fs.unlink(path.join(root, id + '.json'))]);
}

async function sendLocal(file: StoredMedia, res: Response) {
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.filename!);
}

async function putRemote(id: string, body: Buffer, owner: string, mime: string) {
  const response = await storageRequest(`object/${objectPath(id)}`, {
    method: 'POST',
    body: new Uint8Array(body),
    headers: { 'Content-Type': mime, 'x-upsert': 'false', 'Cache-Control': '3600' },
  });
  if (response.status === 409 || response.status === 400 && (await response.clone().text()).includes('Duplicate')) {
    throw Object.assign(new Error('Upload already exists'), { code: 'EEXIST' });
  }
  if (!response.ok) throw new Error('Media upload unavailable');
  try { await db.insert(mediaObjects).values({ id, ownerId: owner, mime, size: body.length }); }
  catch (error) { await deleteStorageObject(id); throw error; }
}

async function getRemote(id: string): Promise<StoredMedia> {
  const [meta] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, id));
  if (!meta) throw Object.assign(new Error('Media not found'), { status: 404, code: 'ENOENT' });
  return { id, owner: meta.ownerId, mime: meta.mime };
}

async function copyRemote(source: StoredMedia, id: string, owner: string) {
  const response = await storageRequest('object/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: storageBucket, sourceKey: source.id, destinationKey: id }),
  });
  if (!response.ok) throw new Error('Unable to copy menu photo');
  try {
    const [meta] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, source.id));
    if (!meta) throw new Error('Source photo not found');
    await db.insert(mediaObjects).values({ id, ownerId: owner, mime: source.mime, size: meta.size });
  } catch (error) { await deleteStorageObject(id); throw error; }
}

async function removeRemote(id: string) {
  await deleteStorageObject(id);
  await db.delete(mediaObjects).where(eq(mediaObjects.id, id));
}

async function sendRemote(file: StoredMedia, res: Response) {
  const range = res.req.get('Range');
  const response = await storageRequest(`object/authenticated/${objectPath(file.id)}`, {
    headers: range ? { Range: range } : {},
  });
  if (![200, 206, 304, 416].includes(response.status)) {
    throw Object.assign(new Error('Photo unavailable'), { status: response.status === 404 ? 404 : 503 });
  }
  res.status(response.status);
  res.set({
    'Content-Type': file.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600',
    'Accept-Ranges': 'bytes',
  });
  for (const name of ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
    const value = response.headers.get(name);
    if (value) res.set(name, value);
  }
  if (!response.body || res.req.method === 'HEAD') {
    await response.body?.cancel();
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body as any), res);
}

export async function putMedia(id: string, body: Buffer, owner: string, mime: string) {
  return useSupabaseStorage ? putRemote(id, body, owner, mime) : putLocal(id, body, owner, mime);
}
export async function getMedia(id: string): Promise<StoredMedia> {
  return useSupabaseStorage ? getRemote(id) : getLocal(id);
}
export async function copyMedia(source: StoredMedia, id: string, owner: string) {
  return useSupabaseStorage ? copyRemote(source, id, owner) : copyLocal(source, id, owner);
}
export async function removeMedia(id: string) {
  return useSupabaseStorage ? removeRemote(id) : removeLocal(id);
}
export async function sendMedia(file: StoredMedia, res: Response) {
  return useSupabaseStorage ? sendRemote(file, res) : sendLocal(file, res);
}

export const usingSupabaseMedia = useSupabaseStorage;
