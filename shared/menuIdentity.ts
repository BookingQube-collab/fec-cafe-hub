function trimOrigin(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : undefined;
}

function viteEnvOrigin(key: 'VITE_PUBLIC_URL' | 'VITE_MANAGEMENT_ORIGIN'): string | undefined {
  try {
    return trimOrigin((import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key]);
  } catch {
    return undefined;
  }
}

function processEnvOrigin(...keys: string[]): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  for (const key of keys) {
    const value = trimOrigin(process.env[key]);
    if (value) return value;
  }
  return undefined;
}

/** Configured public origin only (empty when unset). Used to detect a dedicated guest host. */
export const PUBLIC_MENU_ORIGIN = processEnvOrigin('PUBLIC_URL', 'PUBLIC_MENU_ORIGIN') || viteEnvOrigin('VITE_PUBLIC_URL') || '';

/** Explicit staff origin when split from the guest host (empty when unset). */
const EXPLICIT_MANAGEMENT_ORIGIN = processEnvOrigin('MANAGEMENT_ORIGIN') || viteEnvOrigin('VITE_MANAGEMENT_ORIGIN') || '';

/** Configured staff origin only (falls back to PUBLIC_URL / same host). */
export const MANAGEMENT_ORIGIN = EXPLICIT_MANAGEMENT_ORIGIN || PUBLIC_MENU_ORIGIN || '';

/**
 * True only on a split guest host: PUBLIC_URL is set and an explicit MANAGEMENT_ORIGIN differs.
 * Unified single-host deploys (only PUBLIC_URL set to this Vercel URL) must keep staff routes.
 */
export function isDedicatedPublicMenuHost(origin = typeof window !== 'undefined' ? window.location.origin : ''): boolean {
  return Boolean(
    PUBLIC_MENU_ORIGIN
    && origin === PUBLIC_MENU_ORIGIN
    && EXPLICIT_MANAGEMENT_ORIGIN
    && EXPLICIT_MANAGEMENT_ORIGIN !== PUBLIC_MENU_ORIGIN
  );
}

/** Absolute origin for QR codes and menu links: PUBLIC_URL, else current host, else local default. */
export function publicMenuOrigin(): string {
  return PUBLIC_MENU_ORIGIN
    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5100');
}

export function managementOrigin(): string {
  return MANAGEMENT_ORIGIN
    || PUBLIC_MENU_ORIGIN
    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5100');
}

export function permanentMenuUrl(restaurantId: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(restaurantId)) {
    throw new Error('A saved restaurant is required for its menu QR.');
  }
  return `${publicMenuOrigin()}/menu/${restaurantId}`;
}
