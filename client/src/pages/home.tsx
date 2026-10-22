import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Coffee, ArrowUpRight } from 'lucide-react';
import { cafeThemeStyle } from '@/lib/cafeTheme';
import { PUBLIC_MENU_ORIGIN } from '@shared/menuIdentity';
type Cafe = { id: string; name: string; theme: string; cuisineType: string | null; logoUrl: string | null };
export default function Home() {
  const publicOnly = Boolean(PUBLIC_MENU_ORIGIN && window.location.origin === PUBLIC_MENU_ORIGIN);
  const { data: cafes, isLoading, isError } = useQuery<Cafe[]>({queryKey:['/api/cafes']});
  return <div style={cafeThemeStyle()} className="min-h-screen bg-background text-foreground">
    <header className="mx-auto max-w-6xl flex items-center justify-between px-6 py-7 border-b"><Link href="/" className="font-semibold text-xl flex items-center gap-3"><Coffee className="text-primary" /> Café Collection</Link>{!publicOnly && <Link href="/login" className="text-sm font-medium">Manager login ↗</Link>}</header>
    <main className="mx-auto max-w-6xl px-6 py-16 md:py-24"><p className="text-primary uppercase tracking-[.25em] text-xs font-semibold">A place for every taste</p><h1 className="text-5xl md:text-7xl max-w-3xl font-display leading-tight mt-5">Good coffee.<br />Great company.</h1><p className="text-muted-foreground text-lg mt-6 max-w-lg">Explore our cafés, discover today's specials, and find your next favorite.</p>
    {isLoading ? <p className="mt-12 text-muted-foreground">Loading cafés…</p> : isError ? <p className="mt-12 text-muted-foreground">Could not load cafés. Please refresh.</p> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">{cafes?.map(cafe => <Link key={cafe.id} href={'/menu/'+cafe.id} style={cafeThemeStyle(cafe.theme)} className="block rounded-2xl border bg-card text-card-foreground p-8 transition-shadow hover:shadow-lg"><div className="flex justify-between items-start">{cafe.logoUrl ? <img src={cafe.logoUrl} alt={`${cafe.name} logo`} className="h-14 w-28 rounded-xl object-contain" /> : <Coffee className="h-12 w-12 text-primary" />}<ArrowUpRight className="text-primary" /></div><h2 className="text-3xl font-display mt-8">{cafe.name}</h2><p className="text-muted-foreground mt-2">{cafe.cuisineType || 'Your neighborhood café'}</p><span className="inline-block mt-8 text-sm font-medium text-primary">Explore the menu →</span></Link>)}</div>}
    </main><footer className="mx-auto max-w-6xl border-t px-6 py-6 text-sm text-muted-foreground flex justify-between gap-4"><span>Every café. Its own character.</span>{!publicOnly && <Link href="/login">Manager sign in</Link>}</footer>
  </div>;
}
