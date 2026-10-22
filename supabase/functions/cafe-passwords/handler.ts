type Bcrypt = { hash(password: string, rounds: number): Promise<string>; compare(password: string, hash: string): Promise<boolean> };
export function createPasswordHandler(bcrypt: Bcrypt, secret: string) {
  return async (request: Request) => {
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (!/^[a-f0-9]{64}$/.test(secret)) return reply({ message: 'Unavailable' }, 503);
    if (request.method !== 'POST') return reply({ message: 'Method not allowed' }, 405);
    const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    // Fixed-length digest comparison avoids comparing the secret directly.
    const enc = new TextEncoder();
    const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(provided)), crypto.subtle.digest('SHA-256', enc.encode(secret))]);
    let difference = 0;
    const left = new Uint8Array(a), right = new Uint8Array(b);
    for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
    if (difference) return reply({ message: 'Unauthorized' }, 401);
    if (Number(request.headers.get('Content-Length') || 0) > 1024) return reply({ message: 'Request too large' }, 413);
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ message: 'Invalid request' }, 400);
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 1024) { await reader.cancel(); return reply({ message: 'Request too large' }, 413); } chunks.push(chunk.value); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body.password !== 'string' || enc.encode(body.password).length > 72 || !body.password.length) return reply({ message: 'Invalid request' }, 400);
      if (body.operation === 'hash' && [10,12].includes(body.rounds) && Object.keys(body).every(k => ['operation','password','rounds'].includes(k))) {
        if (body.password.length < 10) return reply({ message: 'Invalid password' }, 400);
        return reply({ hash: await bcrypt.hash(body.password, body.rounds) });
      }
      if (body.operation === 'compare' && typeof body.hash === 'string' && /^\$2[aby]\$(10|12)\$[./A-Za-z0-9]{53}$/.test(body.hash) && Object.keys(body).every(k => ['operation','password','hash'].includes(k))) return reply({ valid: await bcrypt.compare(body.password, body.hash) });
      return reply({ message: 'Invalid request' }, 400);
    } catch { return reply({ message: 'Invalid request' }, 400); }
  };
}
