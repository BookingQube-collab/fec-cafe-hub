import { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { Copy, Download, ExternalLink, Check, QrCode } from 'lucide-react';
import { permanentMenuUrl } from '@shared/menuIdentity';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PermanentMenuQR({ restaurant }: { restaurant: { id: string; name: string } }) {
  const { toast } = useToast();
  const container = useRef<HTMLDivElement>(null);
  const code = useRef<QRCodeStyling | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const menuUrl = permanentMenuUrl(restaurant.id);
  useEffect(() => {
    if (!container.current) return;
    // Menu/profile edits do not regenerate this deterministic restaurant identity.
    const qr = new QRCodeStyling({ width: 600, height: 600, data: menuUrl, margin: 48,
      qrOptions: { mode: 'Byte', errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'square', color: '#141414' }, backgroundOptions: { color: '#ffffff' },
      cornersSquareOptions: { type: 'square', color: '#141414' }, cornersDotOptions: { type: 'square', color: '#141414' },
    });
    const element = container.current;
    element.replaceChildren(); qr.append(element); code.current = qr; setReady(true); setCopied(false);
    return () => { element.replaceChildren(); code.current = null; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [menuUrl]);
  async function download(extension: 'png' | 'svg') {
    if (!code.current) return;
    setDownloading(true);
    try {
      await code.current.download({ extension, name: `menu-qr-${restaurant.id}` });
      toast({ title: 'Menu QR downloaded', description: `Print this ${extension.toUpperCase()} for ${restaurant.name}.` });
    } catch { toast({ title: 'Download failed', description: 'Please try downloading again.', variant: 'destructive' }); }
    finally { setDownloading(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(menuUrl); setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Permanent menu link copied' });
    } catch { toast({ title: 'Select and copy the menu link below.', variant: 'destructive' }); }
  }
  return <div className="grid md:grid-cols-2 gap-6 min-w-0" data-testid="permanent-menu-qr">
    <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5"/>One QR for {restaurant.name}</CardTitle><CardDescription>Keep this code on your tables, counter, and printed menus.</CardDescription></CardHeader>
      <CardContent className="space-y-5"><div ref={container} role="img" aria-label={`${restaurant.name} permanent menu QR code`} data-testid="qr-code-display" className="mx-auto w-full max-w-[300px] aspect-square bg-white rounded-xl overflow-hidden [&>canvas]:w-full [&>canvas]:h-auto [&>svg]:w-full [&>svg]:h-auto"/>
        <div className="flex flex-wrap gap-3"><Button className="flex-1" variant="outline" disabled={!ready || downloading} onClick={() => download('png')} data-testid="button-download-png"><Download className="h-4 w-4 mr-2"/>Download PNG</Button><Button className="flex-1" variant="outline" disabled={!ready || downloading} onClick={() => download('svg')} data-testid="button-download-svg"><Download className="h-4 w-4 mr-2"/>Download SVG</Button></div>
      </CardContent></Card>
    <Card className="min-w-0"><CardHeader><CardTitle>Permanent menu link</CardTitle><CardDescription>This link belongs to this restaurant.</CardDescription></CardHeader><CardContent className="space-y-5">
      <div className="flex gap-2"><Input value={menuUrl} readOnly aria-label="Menu URL" data-testid="input-menu-url" className="font-mono text-sm min-w-0"/><Button variant="outline" size="icon" className="shrink-0" aria-label="Copy menu URL" onClick={copy}>{copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}</Button></div>
      <a href={menuUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary font-medium">Open published menu<ExternalLink className="h-4 w-4"/></a>
      <div className="rounded-xl bg-muted/50 p-4 space-y-2"><p className="font-semibold">Print once. Keep updating.</p><p className="text-sm text-muted-foreground">Items, prices, offers, categories, café name, and theme can change without replacing this QR code. All copies open the same live menu.</p></div>
      <p className="text-xs text-muted-foreground break-all">Restaurant ID: {restaurant.id}</p>
    </CardContent></Card>
  </div>;
}
