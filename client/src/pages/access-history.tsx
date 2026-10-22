import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccessAudit, Restaurant } from '@shared/schema';
function activityLabel(action: string) {
  const [method, path] = action.split(' ');
  const change = method === 'DELETE' ? 'Removed' : method === 'POST' ? 'Added' : 'Updated';
  if (path === '/api/super-admin/cafe-access') return method === 'POST' ? 'Opened café workspace' : 'Returned to platform';
  if (path === '/api/super-admin/users') return 'Created user account';
  if (path?.includes('/users/')) {
    if (path.endsWith('/freeze')) return 'Froze user account';
    if (path.endsWith('/unfreeze')) return 'Unfroze user account';
    if (path.endsWith('/restore')) return 'Restored deleted user account';
    return method === 'DELETE' ? 'Deleted user account access' : 'Updated account role or details';
  }
  if (path?.endsWith('/password')) return path.includes('/restaurants/') ? 'Reset café manager password' : 'Changed own account password';
  if (path?.endsWith('/visibility')) return 'Changed café visibility';
  if (path?.endsWith('/suspend')) return 'Suspended café';
  if (path?.endsWith('/activate')) return 'Activated café';
  if (path?.endsWith('/subscription')) return 'Updated café subscription';
  if (path?.endsWith('/upload')) return 'Prepared café photo upload';
  if (path?.endsWith('/cover-media') || path?.endsWith('/logo')) return 'Updated café branding image';
  if (path === '/api/manager-menu') return 'Saved menu item and price options';
  if (path === '/api/category-order') return 'Reordered café categories';
  if (path === '/api/cafe-menu') return 'Cleared café menu';
  if (path?.endsWith('/publish')) return 'Saved café menu to global library';
  if (path?.endsWith('/import')) return 'Copied global items into café menu';
  if (path?.startsWith('/api/menu-library/')) return 'Removed global library template';
  if (path?.includes('/categories')) return `${change} café category`;
  if (path?.includes('/price-variants')) return `${change} price option`;
  if (path?.includes('/menu-items')) return `${change} menu item`;
  if (path?.includes('/payments')) return 'Recorded café payment';
  if (path === '/api/restaurant' || path?.endsWith('/profile')) return 'Updated café profile';
  if (path === '/api/admin/menu-design') return 'Updated Arena menu design';
  if (path?.includes('/restaurants/')) return method === 'DELETE' ? 'Removed café account' : 'Updated café settings';
  return 'Updated a management resource';
}
export default function AccessHistory() {
  const audit = useQuery<AccessAudit[]>({ queryKey: ['/api/super-admin/access-audit'], staleTime: 10000 });
  const cafes = useQuery<Restaurant[]>({ queryKey: ['/api/super-admin/restaurants'] });
  const names = new Map((cafes.data || []).map(c => [c.id, c.name]));
  return <div className="space-y-5"><div className="manager-section-heading"><div><p className="manager-eyebrow">PLATFORM / ACCESS HISTORY</p><h1 className="text-3xl font-bold flex items-center gap-3"><History className="text-primary"/>Access history</h1><p className="text-sm text-muted-foreground mt-2">Recent workspace access and management changes, attributed to the signed-in account.</p></div><Button variant="outline" disabled={audit.isFetching} onClick={() => audit.refetch()}><RefreshCw size={15} className="mr-2"/>Refresh</Button></div>
    {audit.isLoading ? <div className="manager-panel p-8" role="status">Loading access history…</div> : audit.isError ? <div className="manager-panel p-8" role="alert">Could not load access history.</div> : !audit.data?.length ? <div className="manager-panel p-8">Management activity will appear here.</div> : <div className="space-y-3">{audit.data.map(entry => <article className="manager-panel p-4 flex flex-wrap gap-4 items-start" key={entry.id}><div className="flex-1 min-w-0"><h2 className="font-semibold text-sm break-all">{entry.actorEmail}</h2><p className="text-xs text-muted-foreground mt-1">{entry.actorRole === 'super_admin' ? 'Super admin' : 'Café manager'} · {entry.cafeId ? entry.cafeName || names.get(entry.cafeId) || 'Deleted café' : 'Platform'}</p><p className="text-xs mt-3">{entry.status >= 400 ? 'Attempted: ' : ''}{activityLabel(entry.action)}</p></div><div className="text-xs text-muted-foreground"><span className={`manager-chip ${entry.status >= 400 ? 'text-destructive' : ''}`}>{entry.status >= 400 ? 'Blocked' : 'Completed'}</span><p className="mt-3">{new Date(entry.createdAt).toLocaleString()}</p></div></article>)}</div>}
  </div>;
}
