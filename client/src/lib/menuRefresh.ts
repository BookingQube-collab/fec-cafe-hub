export class MenuLoadError extends Error {
  constructor(readonly status: number) { super('This café menu is temporarily unavailable.'); }
}

export async function getMenuData<T>(url: string, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { signal, credentials: 'omit' }); }
  catch (error) { if (signal.aborted) throw error; throw new MenuLoadError(0); }
  if (!response.ok) throw new MenuLoadError(response.status);
  return response.json();
}

// Keep a brief, explicitly stale snapshot during a connection failure, but
// never retain a revoked/hidden café (404/403) or indefinitely stale prices.
export function keepMenuDuringReconnect(error: unknown, updatedAt: number, now: number): boolean {
  return error instanceof MenuLoadError && (error.status === 0 || error.status === 429 || error.status >= 500)
    && updatedAt > 0 && now - updatedAt < 30000;
}
