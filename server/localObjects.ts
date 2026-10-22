import express, { type Express, type Response } from 'express';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { mediaOwner } from './accessControl';
import { storage } from './storage';
import { rateLimit } from './httpSecurity';
import { putMedia, getMedia, copyMedia, removeMedia, sendMedia, type StoredMedia } from './mediaStore';
function imageDimensionsValid(body: Buffer, mime: string): boolean {
  const sizeOK = (w: number, h: number) => w > 0 && h > 0 && w <= 12000 && h <= 12000 && w * h <= 40000000;
  if (mime === 'image/png') return body.length >= 45 && body.subarray(12,16).toString() === 'IHDR' && body.subarray(-8,-4).toString() === 'IEND' && sizeOK(body.readUInt32BE(16), body.readUInt32BE(20));
  if (mime === 'image/gif') return body.length >= 14 && body[body.length - 1] === 59 && sizeOK(body.readUInt16LE(6),body.readUInt16LE(8));
  if (mime === 'image/webp') {
    if (body.length < 30 || body.readUInt32LE(4) + 8 !== body.length) return false;
    let imageFound = false;
    for (let offset = 12; offset < body.length;) {
      if (offset + 8 > body.length) return false;
      const kind = body.subarray(offset, offset + 4).toString();
      const length = body.readUInt32LE(offset + 4), start = offset + 8;
      if (start + length + (length % 2) > body.length) return false;
      if (kind === 'VP8X' && (length !== 10 || !sizeOK(body.readUIntLE(start + 4, 3) + 1, body.readUIntLE(start + 7, 3) + 1))) return false;
      if (kind === 'VP8 ') {
        if (length < 10 || !body.subarray(start + 3, start + 6).equals(Buffer.from([157, 1, 42])) || !sizeOK(body.readUInt16LE(start + 6) & 16383, body.readUInt16LE(start + 8) & 16383)) return false;
        imageFound = true;
      }
      if (kind === 'VP8L') {
        if (length < 5 || body[start] !== 47) return false;
        const packed = body.readUInt32LE(start + 1);
        if (!sizeOK((packed & 16383) + 1, ((packed >>> 14) & 16383) + 1)) return false;
        imageFound = true;
      }
      if (kind === 'ANMF') {
        if (length < 24) return false;
        imageFound = true;
      }
      offset = start + length + (length % 2);
    }
    return imageFound;
  }
  if (mime === 'image/jpeg') {
    if (body.length < 20 || body[body.length-2] !== 255 || body[body.length-1] !== 217) return false;
    for (let i = 2; i + 9 < body.length;) {
      if (body[i] !== 255) return false;
      const marker = body[i + 1];
      if (marker === 255) { i++; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4,0xc8,0xcc].includes(marker)) return sizeOK(body.readUInt16BE(i+7), body.readUInt16BE(i+5));
      if ([0xd8,0xd9,0x01].includes(marker) || marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
      const length = body.readUInt16BE(i+2);
      if (length < 2 || i + length + 2 > body.length) return false;
      i += length + 2;
    }
    return false;
  }
  return body.length >= 16 && body.readUInt32BE(0) >= 12 && body.readUInt32BE(0) <= body.length;
}
export class ObjectNotFoundError extends Error {}
function token(id: string, owner: string, actor: string, version: number, expiry: number) {
  return createHmac('sha256', process.env.SESSION_SECRET!).update(`${id}:${owner}:${actor}:${version}:${expiry}`).digest('hex');
}
export function signedUploadURL(owner: string, actor: {id:string;updatedAt:Date|null}) {
  const id = randomUUID(), expiry = Date.now() + 600000;
  const version = actor.updatedAt?.getTime() || 0;
  return `/objects/${id}?owner=${owner}&actor=${actor.id}&version=${version}&expiry=${expiry}&token=${token(id, owner, actor.id, version, expiry)}`;
}
export function mountLocalUploads(app: Express) {
  app.post('/api/objects/upload', rateLimit(100, 60 * 60 * 1000, req => (req as any).user?.id || req.ip), async (req, res, next) => {
    try {
      const owner = await mediaOwner(req);
      res.json({ uploadURL: signedUploadURL(owner, (req as any).user) });
    } catch (e) { next(e); }
  });
  // Reject forged/revoked URLs before buffering up to 5 MB of attacker input.
  app.put('/objects/:id', async (req, res, next) => {
    try {
      const { owner, actor, version, expiry, token: signature } = req.query;
      if (!/^[a-f0-9-]{36}$/.test(req.params.id) || typeof owner !== 'string' || typeof actor !== 'string' || !Number.isFinite(Number(version)) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature) || Number(expiry) < Date.now() || !Number.isFinite(Number(expiry))) return res.sendStatus(403);
      const expected = token(req.params.id, owner, actor, Number(version), Number(expiry));
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.sendStatus(403);
      if (!await storage.getUser(owner)) return res.sendStatus(403);
      const uploader = await storage.getUser(actor);
      if (!uploader || uploader.accountStatus !== 'active' || !['admin','super_admin'].includes(uploader.role) || (uploader.updatedAt?.getTime() || 0) !== Number(version)) return res.sendStatus(403);
      next();
    } catch (error) { next(error); }
  }, express.raw({ type: () => true, limit: '5mb' }), async (req, res, next) => {
    try {
      const owner = req.query.owner as string;
      const body: Buffer = req.body;
      if (!Buffer.isBuffer(body) || !body.length) return res.status(400).json({ message: 'Upload a media file' });
      let mime = '';
      if (body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
      else if (body[0] === 255 && body[1] === 216 && body[2] === 255) mime = 'image/jpeg';
      else if (/^GIF8[79]a$/.test(body.subarray(0,6).toString())) mime = 'image/gif';
      else if (body.subarray(0,4).toString() === 'RIFF' && body.subarray(8,12).toString() === 'WEBP') mime = 'image/webp';
      else if (body.subarray(4,8).toString() === 'ftyp') mime = 'video/mp4';
      else if (body.subarray(0,4).toString() === 'glTF') mime = 'model/gltf-binary';
      if (!mime) return res.status(400).json({ message: 'Use PNG, JPEG, GIF, WebP, MP4, or GLB media' });
      if (mime !== 'model/gltf-binary' && !imageDimensionsValid(body, mime)) return res.status(400).json({ message: 'This media file is incomplete or too large in dimensions. Choose another file.' });
      await putMedia(req.params.id, body, owner, mime);
      res.json({ success: true });
    } catch (error: any) { if (error.code === 'EEXIST') return res.status(409).json({ message: 'This upload was already completed' }); next(error); }
  });
}
export class ObjectStorageService {
  async mediaType(url: string, imageOnly = false): Promise<'image' | 'video' | 'gif'> {
    const file = await this.getObjectEntityFile(url);
    if (imageOnly && !file.mime.startsWith('image/')) throw Object.assign(new Error('Choose an image for this field'), { status: 400 });
    return file.mime === 'video/mp4' ? 'video' : file.mime === 'image/gif' ? 'gif' : 'image';
  }
  async copyForOwner(url: string, owner: string) {
    const source = await this.getObjectEntityFile(url);
    const id = randomUUID();
    await copyMedia(source, id, owner);
    return `/objects/${id}`;
  }
  async removeCopiedObject(url: string) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new Error('Invalid object path');
    const id = url.split('/').pop()!;
    await removeMedia(id);
  }
  async trySetObjectEntityAclPolicy(url: string, policy: { owner: string; visibility: string }) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new Error('Upload media before saving');
    const meta = await getMedia(url.split('/').pop()!);
    if (meta.owner !== policy.owner) throw new Error('Media belongs to another account');
    return url;
  }
  async getObjectEntityFile(url: string) {
    if (!/^\/objects\/[a-f0-9-]{36}$/.test(url)) throw new ObjectNotFoundError();
    const id = url.split('/').pop()!;
    try {
      return await getMedia(id);
    } catch (error: any) { if (error.code === 'ENOENT' || error.status === 404) throw new ObjectNotFoundError(); throw error; }
  }
  async downloadObject(file: StoredMedia, res: Response) {
    await sendMedia(file, res);
  }
  async getObjectEntityUploadURL(): Promise<string> { throw new Error('Use local upload endpoint'); }
  async searchPublicObject(_path: string): Promise<undefined> { return undefined; }
}
