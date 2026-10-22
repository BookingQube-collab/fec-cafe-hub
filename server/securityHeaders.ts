// Shared by Express and the Worker so assets and early error responses receive
// the same protections as API responses. Inline styles are used by the UI.
export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function securityHeaders(production: boolean, https: boolean): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(production ? { 'Content-Security-Policy': CONTENT_SECURITY_POLICY } : {}),
    ...(production && https ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}

export function secureWorkerResponse(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(true, new URL(request.url).protocol === 'https:'))) {
    // Keep a stricter CSP on the public-origin denial page.
    if (name === 'Content-Security-Policy' && headers.get(name)?.startsWith("default-src 'none'")) continue;
    if (name === 'Referrer-Policy' && headers.has(name)) continue;
    headers.set(name, value);
  }
  if (new URL(request.url).pathname.startsWith('/api/') ||
      headers.get('Content-Type')?.includes('text/html') || headers.has('Set-Cookie')) {
    headers.set('Cache-Control', 'no-store');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Avoid logging SQL parameters, session IDs, signed URLs or credentials embedded
// in provider errors. The diagnostic type/code still identify the failure.
export function safeError(error: unknown) {
  const value = error as { name?: string; code?: string; cause?: { code?: string } } | null;
  return { type: value?.name || 'Error', code: value?.code || value?.cause?.code };
}
