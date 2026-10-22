import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export default function UnsavedChanges({ dirty }: { dirty: boolean }) {
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const leaving = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [, navigate] = useLocation();
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if(dirtyRef.current && !leaving.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || !(event.target instanceof Element) || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const next = new URL(anchor.href, location.href);
      if (next.pathname === location.pathname && next.search === location.search && next.origin === location.origin) return;
      event.preventDefault(); event.stopImmediatePropagation(); setPending(next.href);
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, []);
  return <Dialog open={!!pending} onOpenChange={open => { if(!open) setPending(null); }}><DialogContent><DialogTitle>Keep your unsaved changes?</DialogTitle><DialogDescription>Your café profile has edits that have not been published. Stay here to save them, or discard them and leave.</DialogDescription><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPending(null)}>Keep editing</Button><Button type="button" onClick={() => { if(!pending) return; leaving.current=true; const url=new URL(pending); setPending(null); if(url.origin===location.origin) navigate(url.pathname+url.search+url.hash); else window.location.assign(url.href); }}>Discard and leave</Button></div></DialogContent></Dialog>;
}
