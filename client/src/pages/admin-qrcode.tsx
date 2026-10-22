import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import PermanentMenuQR from '@/components/permanent-menu-qr';
import type { Restaurant } from '@shared/schema';

export default function AdminQRCode() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const query = useQuery<Restaurant>({ queryKey: ['/api/restaurant'], enabled: isAuthenticated });
  if (authLoading || query.isLoading) return <p role="status">Loading restaurant QR…</p>;
  if (!isAuthenticated) return null;
  if (query.isError) return <div className="manager-panel p-6">Could not load your restaurant QR. <Button onClick={() => query.refetch()}>Try again</Button></div>;
  return <div className="space-y-6"><div><p className="manager-eyebrow">YOUR RESTAURANT’S PERMANENT LINK</p><h1 className="text-3xl font-bold" data-testid="text-qrcode-title">Menu QR code</h1><p className="text-muted-foreground mt-2">One permanent QR for each restaurant. Download and print as many copies as you need.</p></div>{query.data ? <PermanentMenuQR key={query.data.id} restaurant={query.data}/> : <p>Set up your restaurant profile to get its permanent menu QR.</p>}</div>;
}
