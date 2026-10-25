import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Coffee, ArrowUpRight } from 'lucide-react';
import { cafeThemeStyle } from '@/lib/cafeTheme';
import { isDedicatedPublicMenuHost } from '@shared/menuIdentity';
import './home.css';

type Cafe = { id: string; name: string; theme: string; cuisineType: string | null; logoUrl: string | null };

export default function Home() {
  const publicOnly = isDedicatedPublicMenuHost();
  const { data: cafes, isLoading, isError } = useQuery<Cafe[]>({ queryKey: ['/api/cafes'] });

  return (
    <div style={cafeThemeStyle()} className="hub-home min-h-screen w-full text-foreground">
      <div className="hub-home-atmosphere" aria-hidden="true" />

      <header className="hub-home-header relative z-[1] border-b border-foreground/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
          <Link href="/" className="font-semibold text-xl flex items-center gap-3 tracking-tight">
            <Coffee className="text-primary" /> Café Collection
          </Link>
          {!publicOnly && (
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">
              Manager login ↗
            </Link>
          )}
        </div>
      </header>

      <main className="relative z-[1]">
        <section className="hub-home-hero mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
          <p className="hub-home-kicker text-primary uppercase tracking-[.25em] text-xs font-semibold">
            A place for every taste
          </p>
          <h1 className="hub-home-title text-5xl md:text-7xl max-w-3xl font-display leading-tight mt-5">
            Good coffee.<br />Great company.
          </h1>
          <p className="text-muted-foreground text-lg mt-6 max-w-lg">
            Explore our cafés, discover today&apos;s specials, and find your next favorite.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 md:pb-28" aria-label="Cafés">
          {isLoading ? (
            <p className="text-muted-foreground">Loading cafés…</p>
          ) : isError ? (
            <p className="text-muted-foreground">Could not load cafés. Please refresh.</p>
          ) : (
            <div className="hub-home-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {cafes?.map((cafe, i) => (
                <Link
                  key={cafe.id}
                  href={'/menu/' + cafe.id}
                  style={{ ...cafeThemeStyle(cafe.theme), animationDelay: `${80 + i * 70}ms` } as CSSProperties}
                  className="hub-home-card block rounded-2xl border border-foreground/10 bg-card text-card-foreground p-8 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/25"
                >
                  <div className="flex justify-between items-start">
                    {cafe.logoUrl ? (
                      <img src={cafe.logoUrl} alt={`${cafe.name} logo`} className="h-14 w-28 rounded-xl object-contain" />
                    ) : (
                      <Coffee className="h-12 w-12 text-primary" />
                    )}
                    <ArrowUpRight className="text-primary shrink-0" />
                  </div>
                  <h2 className="text-3xl font-display mt-8">{cafe.name}</h2>
                  <p className="text-muted-foreground mt-2">{cafe.cuisineType || 'Your neighborhood café'}</p>
                  <span className="inline-block mt-8 text-sm font-medium text-primary">Explore the menu →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-[1] border-t border-foreground/10">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground flex justify-between gap-4">
          <span>Every café. Its own character.</span>
          {!publicOnly && <Link href="/login">Manager sign in</Link>}
        </div>
      </footer>
    </div>
  );
}
