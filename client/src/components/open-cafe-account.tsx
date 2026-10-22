import { useState } from 'react';
import { LogIn, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { openCafeWorkspace } from '@/lib/cafeAccess';

export function OpenCafeAccount({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return <Button size="sm" disabled={busy} aria-label={`Open ${name} account`} data-testid={`open-cafe-account-${id}`} onClick={async () => {
    setBusy(true);
    try { await openCafeWorkspace(id); }
    catch(e) { setBusy(false); toast({ title: 'Could not open café account', description: (e as Error).message, variant: 'destructive' }); }
  }}><LogIn size={15} className="mr-2"/>{busy ? 'Opening…' : 'Open café account'}</Button>;
}

/** Super-admin shortcut: open this café’s workspace on Menu design (Arena look, per location). */
export function OpenCafeMenuDesign({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      aria-label={`Edit ${name} menu design`}
      data-testid={`open-cafe-menu-design-${id}`}
      onClick={async () => {
        setBusy(true);
        try {
          await openCafeWorkspace(id, '/admin/menu-design');
        } catch (e) {
          setBusy(false);
          toast({
            title: 'Could not open menu design',
            description: (e as Error).message,
            variant: 'destructive',
          });
        }
      }}
    >
      <Palette size={15} className="mr-2" />
      {busy ? 'Opening…' : 'Menu design'}
    </Button>
  );
}
