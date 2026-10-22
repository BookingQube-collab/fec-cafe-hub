import fs from 'node:fs/promises';
import path from 'node:path';
import type { Response } from 'express';
const root = path.resolve('data/uploads');
export type StoredMedia = { id: string; owner: string; mime: string; filename?: string };
export async function putMedia(id: string, body: Buffer, owner: string, mime: string) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, id), body, { flag: 'wx' });
  try { await fs.writeFile(path.join(root, id + '.json'), JSON.stringify({ owner, mime }), { flag: 'wx' }); }
  catch (error) { await fs.unlink(path.join(root, id)); throw error; }
}
export async function getMedia(id: string): Promise<StoredMedia> {
  const meta = JSON.parse(await fs.readFile(path.join(root, id + '.json'), 'utf8'));
  return { id, owner: meta.owner, mime: meta.mime, filename: path.join(root, id) };
}
export async function copyMedia(source: StoredMedia, id: string, owner: string) {
  await fs.copyFile(source.filename!, path.join(root, id), 1);
  try { await fs.writeFile(path.join(root, id + '.json'), JSON.stringify({ owner, mime: source.mime }), { flag: 'wx' }); }
  catch (error) { await fs.unlink(path.join(root, id)); throw error; }
}
export async function removeMedia(id: string) {
  await Promise.allSettled([fs.unlink(path.join(root, id)), fs.unlink(path.join(root, id + '.json'))]);
}
export async function sendMedia(file: StoredMedia, res: Response) {
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.filename!);
}
