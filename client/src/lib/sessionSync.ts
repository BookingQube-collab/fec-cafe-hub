import { useEffect } from 'react';
import { queryClient } from './queryClient';
const sessionKey = 'cafe-manager-session-change';
const contentKey = 'cafe-menu-content-change';
export function notifyContentChanged() {
  try { localStorage.setItem(contentKey, `${Date.now()}-${Math.random()}`); } catch { /* Visible pages also refresh periodically. */ }
}
export function notifySessionChanged() {
  try { localStorage.setItem(sessionKey, `${Date.now()}-${Math.random()}`); } catch { /* Login also performs a full navigation. */ }
}
export function useSessionSync() {
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (!event.newValue) return;
      if (event.key === sessionKey) window.location.reload();
      else if (event.key === contentKey) void queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith('/api/') && q.queryKey[0] !== '/api/auth/user' });
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
}
