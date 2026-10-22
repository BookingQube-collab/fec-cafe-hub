function trimOrigin(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : undefined;
}

function vitePublicUrl(): string | undefined {
  try {
    return trimOrigin((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PUBLIC_URL);
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
export const PUBLIC_MENU_ORIGIN = processEnvOrigin('PUBLIC_URL', 'PUBLIC_MENU_ORIGIN') || vitePublicUrl() || '';

/** Configured staff origin only (empty when unset / same host as Node). */
export const MANAGEMENT_ORIGIN = processEnvOrigin('MANAGEMENT_ORIGIN', 'PUBLIC_URL') || vitePublicUrl() || '';

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
