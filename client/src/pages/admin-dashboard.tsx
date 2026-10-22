import { Link } from 'wouter';
import { ExternalLink, Palette, FolderPlus, QrCode, UtensilsCrossed, Eye, Sparkles, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useManagerMenu } from '@/lib/managerMenu';
import { cafeDate } from '@/lib/cafeTheme';
import { ManagerMenu } from '@/components/manager-menu';
export default function AdminDashboard() {
  const { data } = useManagerMenu();
  const cafe = data?.restaurant, items = data?.items || [], today = cafeDate(cafe?.timezone);
  const discounted = new Set(items.filter(i => Number(i.discount) > 0).map(i => i.id));
  for (const v of data?.variants || []) if (Number(v.discount) > 0) discounted.add(v.menuItemId);
  const stats = [{ label: 'Menu items', count: items.length, icon: UtensilsCrossed }, { label: 'Visible to guests', count: items.filter(i => i.isAvailable).length, icon: Eye }, { label: 'Today’s specials', count: items.filter(i => i.isAvailable && i.specialDate === today).length, icon: Sparkles }, { label: 'Items with discounts', count: discounted.size, icon: BadgePercent }];
  return <div className="space-y-8"><section className="manager-hero"><div><p className="manager-eyebrow">CAFÉ MANAGER / OVERVIEW</p><h1 data-testid="text-dashboard-title">{cafe?.name || 'Your café dashboard'}</h1><p>Your menu, beautifully managed. Every item, category and offer in one place.</p><div className="flex flex-wrap gap-2 mt-5"><Link href="/admin/restaurant"><Button variant="outline"><Palette className="w-4 h-4 mr-2"/>Profile & theme</Button></Link><Link href="/admin/categories"><Button variant="outline"><FolderPlus className="w-4 h-4 mr-2"/>Manage categories</Button></Link><Link href="/admin/qr-code"><Button variant="outline"><QrCode className="w-4 h-4 mr-2"/>Menu QR</Button></Link></div></div><div className="manager-live-card"><span className="manager-live-dot"/><span>{cafe && cafe.status === 'active' && !cafe.hidden ? 'Live customer menu' : 'Café setup'}</span><strong>{data?.categories.length || 0} categories</strong><p>{cafe?.currency || 'Set currency'} · {cafe?.timezone || 'Set timezone'}</p>{cafe && <a href={`/menu/${cafe.id}`} target="_blank" rel="noreferrer"><Button>Open customer menu<ExternalLink className="w-4 h-4 ml-2"/></Button></a>}</div></section><div className="manager-stats">{stats.map(s => <div key={s.label} className="manager-stat"><s.icon className="w-5 h-5 text-primary"/><strong>{data ? s.count : '…'}</strong><span>{s.label}</span></div>)}</div><ManagerMenu dashboard/></div>;
}
