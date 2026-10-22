import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, BookmarkPlus, Check, GripVertical, LibraryBig, Search, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { managerMoney, refreshCafe } from '@/lib/managerMenu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { matchesMenuSearch, menuSearchIndex, menuSearchQuery } from '@/lib/menuSearch';
import type { Category, GlobalMenuItem, MenuItem } from '@shared/schema';
import './menu-library.css';

type LibraryItem = Omit<GlobalMenuItem, 'sourceImageUrl'> & { canManage: boolean };
type Target = { id: string; name: string; currency: string; theme: string; categories: Category[] };
type ImportResult = { added: number; skipped: number };
const itemCount = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;
const dragType = 'application/x-cafe-menu-library';

export default function MenuLibrary() {
  const { toast } = useToast();
  const { user } = useAuth();
  const library = useQuery<LibraryItem[]>({ queryKey: ['/api/menu-library'], staleTime: 30000 });
  const targets = useQuery<Target[]>({ queryKey: ['/api/menu-library/targets'], staleTime: 30000 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [destinationCategory, setDestinationCategory] = useState('auto');
  const [visible, setVisible] = useState(false);
  const [acceptCurrency, setAcceptCurrency] = useState(false);
  const [formError, setFormError] = useState('');
  const [removing, setRemoving] = useState<LibraryItem | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [transferProgress, setTransferProgress] = useState<{ done: number; total: number } | null>(null);
  const destinationRef = useRef<HTMLElement>(null);
  const pointerDrag = useRef<{ ids: string[]; startX: number; startY: number; moved: boolean } | null>(null);
  const [dragLabel, setDragLabel] = useState<{ x: number; y: number; count: number } | null>(null);
  const items = library.data || [];
  const target = targets.data?.find(t => t.id === targetId) || targets.data?.find(t => t.id === user?.cafeContext?.id) || targets.data?.[0];
  const categories = Array.from(new Set(items.map(i => i.categoryTitle)));
  const searchQuery = menuSearchQuery(search);
  const filtered = items.filter(i => (category === 'all' || i.categoryTitle === category) && matchesMenuSearch(menuSearchIndex({ ...i, description: `${i.sourceCafe} ${i.description || ''}` }, i.categoryTitle, [...i.variants.map(v => v.label), ...(i.modifierGroups || []).flatMap(g => [g.title, g.titleAr || '', ...g.options.flatMap(o => [o.label, o.labelAr || ''])])]), searchQuery));
  const review = items.filter(i => reviewIds?.includes(i.id));
  const currencyDifference = !!target && review.some(i => i.currency !== target.currency);
  const validSelection = selected.filter(id => items.some(i => i.id === id));
  const fail = (error: Error) => toast({ title: 'Could not update library', description: error.message, variant: 'destructive' });
  const publish = useMutation({ mutationFn: async () => {
    if (!target) throw new Error('Set up a café first.');
    const source: MenuItem[] = user?.role === 'super_admin'
      ? await (await apiRequest('GET', `/api/super-admin/menu-items/${target.id}`)).json()
      : (await (await apiRequest('GET', '/api/manager-menu')).json()).items;
    let saved = 0;
    setTransferProgress({ done: 0, total: source.length });
    try {
      for (const item of source) {
        const result = await (await apiRequest('POST', '/api/menu-library/publish', { restaurantId: target.id, itemIds: [item.id] })).json();
        saved += result.saved; setTransferProgress({ done: saved, total: source.length });
      }
      return { saved };
    } catch (error) { await refreshCafe('library'); throw new Error(`${saved} items saved. You can retry safely. ${(error as Error).message}`); }
  }, onSuccess: async ({ saved }) => { await refreshCafe('library'); toast({ title: `${saved} items saved to the global library`, description: 'Existing templates refreshed. Café menus are unchanged.' }); }, onError: fail, onSettled: () => setTransferProgress(null) });
  const importing = useMutation({ mutationFn: async () => {
    if (!target || !reviewIds?.length || review.length !== reviewIds.length) throw new Error('Refresh the library and choose available items.');
    const result: ImportResult = { added: 0, skipped: 0 };
    setTransferProgress({ done: 0, total: reviewIds.length });
    try {
      for (const id of reviewIds) {
        const batch: ImportResult = await (await apiRequest('POST', '/api/menu-library/import', { restaurantId: target.id, itemIds: [id],
          ...(destinationCategory === 'auto' ? {} : { categoryId: destinationCategory }), isAvailable: visible, acceptCurrencyDifference: acceptCurrency })).json();
        result.added += batch.added; result.skipped += batch.skipped;
        setTransferProgress({ done: result.added + result.skipped, total: reviewIds.length });
      }
      return result;
    } catch (error) { await refreshCafe('library'); throw new Error(`${result.added} items added, ${result.skipped} skipped. Retry to finish; existing items are skipped. ${(error as Error).message}`); }
  }, onSuccess: async data => {
    const imported = new Set(reviewIds);
    setSelected(prev => prev.filter(id => !imported.has(id))); setReviewIds(null); setResult(data);
    await refreshCafe('library'); toast({ title: data.added ? `${data.added} items added to ${target?.name}` : 'No duplicate items added', description: data.added ? `${data.skipped ? `${data.skipped} existing items skipped. ` : ''}${visible ? 'Visible on the customer menu.' : 'Saved as hidden items for you to review.'}` : 'All selected items already exist in the destination categories.' });
  }, onError: (error: Error) => setFormError(error.message), onSettled: () => setTransferProgress(null) });
  const remove = useMutation({ mutationFn: (id: string) => apiRequest('DELETE', `/api/menu-library/${id}`), onSuccess: async () => {
    setRemoving(null); await refreshCafe('library'); toast({ title: 'Template removed from library', description: 'Existing café copies remain available.' });
  }, onError: fail });
  function openReview(ids: string[]) {
    if (!target || importing.isPending) return;
    const valid = Array.from(new Set(ids)).filter(id => items.some(i => i.id === id));
    if (!valid.length) return;
    setReviewIds(valid); setDestinationCategory('auto'); setVisible(false); setAcceptCurrency(false); setFormError('');
  }
  function toggle(id: string) { setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); }
  function overDestination(x: number, y: number) {
    const rect = destinationRef.current?.getBoundingClientRect();
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function startPointerDrag(e: PointerEvent<HTMLElement>, id: string) {
    if (!target || importing.isPending || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    pointerDrag.current = { ids: selected.includes(id) ? validSelection : [id], startX: e.clientX, startY: e.clientY, moved: false };
  }
  function movePointerDrag(e: PointerEvent<HTMLElement>) {
    const drag = pointerDrag.current;
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 8) drag.moved = true;
    if (drag.moved) { setDragLabel({ x: e.clientX, y: e.clientY, count: drag.ids.length }); setDragOver(overDestination(e.clientX, e.clientY)); }
  }
  function endPointerDrag(e: PointerEvent<HTMLElement>) {
    const drag = pointerDrag.current;
    pointerDrag.current = null; setDragLabel(null); setDragOver(false);
    if (drag?.moved && overDestination(e.clientX, e.clientY)) openReview(drag.ids);
  }

  if (library.isLoading || targets.isLoading) return <div className="manager-panel p-8" role="status">Loading the global menu library…</div>;
  if (library.isError || targets.isError) return <div className="manager-panel p-8">Could not load the library. <Button onClick={() => { library.refetch(); targets.refetch(); }}>Try again</Button></div>;

  return <div className="menu-library space-y-6">
    <div className="manager-section-heading"><div><p className="manager-eyebrow">SHARED ACROSS YOUR CAFÉS</p><h1 className="text-3xl font-bold flex items-center gap-3"><LibraryBig className="text-primary"/>Global menu library</h1><p className="text-muted-foreground text-sm">Save once. Add to any café you manage. Every copy stays independent.</p></div><span className="library-total">{items.length} reusable items</span></div>
    <div className="library-layout">
      <section className="min-w-0" aria-label="Library items">
        <div className="manager-panel manager-filters"><div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground"/><Input aria-label="Search global menu" placeholder="Search items, categories or café…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="Library category" className="manager-select" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="library-selection"><span role="status">{itemCount(filtered.length)} · {validSelection.length} selected</span><div><Button variant="ghost" size="sm" disabled={!filtered.length} onClick={() => setSelected(prev => Array.from(new Set([...prev, ...filtered.map(i => i.id)])))}>Select shown</Button>{validSelection.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear selection</Button>}</div></div>
        {!items.length ? <div className="manager-panel p-8 text-center"><LibraryBig className="mx-auto mb-4 text-primary"/><h2 className="font-bold">Start your shared collection</h2><p className="text-sm text-muted-foreground mt-2">Save a café’s menu using the panel to the right, then reuse its items here.</p></div> : !filtered.length ? <div className="manager-panel p-8">No items match your search.</div> : <div className="library-grid">{filtered.map(item => <article className={`library-card ${selected.includes(item.id) ? 'is-selected' : ''}`} key={item.id} draggable={!!target && !importing.isPending}
          onDragStart={e => { e.dataTransfer.setData(dragType, JSON.stringify(selected.includes(item.id) ? validSelection : [item.id])); e.dataTransfer.effectAllowed = 'copy'; }} data-testid={`library-item-${item.id}`}>
          <div className="library-card-photo">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" draggable={false}/> : <LibraryBig aria-hidden="true"/>}<label className="library-card-select"><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><span aria-hidden="true"><Check size={15}/></span></label><span className="library-card-drag" aria-hidden="true" onPointerDown={e => startPointerDrag(e, item.id)} onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={() => { pointerDrag.current = null; setDragLabel(null); setDragOver(false); }}><GripVertical size={16}/></span></div>
          <div className="library-card-body"><p className="library-card-category">{item.categoryTitle}</p><h2>{item.name}</h2><strong className="library-card-price">{item.variants.length ? 'From ' : ''}{managerMoney(item.variants.length ? Math.min(...item.variants.map(v => Number(v.price))) : item.price, item.currency)}</strong><p className="library-card-source">{item.sourceCafe}{item.variants.length > 0 && ` · ${item.variants.length} price options`}</p><div className="library-card-actions"><Button variant="outline" size="sm" disabled={!target || importing.isPending} onClick={() => openReview([item.id])}><ArrowDownToLine size={14} className="mr-2"/>Add to café</Button>{item.canManage && <Button variant="ghost" size="icon" aria-label={`Remove ${item.name} from library`} onClick={() => setRemoving(item)}><Trash2 size={14}/></Button>}</div></div>
        </article>)}</div>}
      </section>
      <aside ref={destinationRef} className={`library-destination manager-panel ${dragOver ? 'is-dragging' : ''}`} aria-label="Destination café"
        onDragOver={e => { if (e.dataTransfer.types.includes(dragType) && target && !importing.isPending) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); try { const ids: unknown = JSON.parse(e.dataTransfer.getData(dragType)); if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) openReview(ids); } catch { /* Ignore drops from outside this library. */ } }}>
        <div className="library-destination-icon"><Store size={24}/></div><h2>Add to a café</h2><p className="text-sm text-muted-foreground mb-5">Choose items or drop them here.</p>
        <label htmlFor="library-target" className="text-xs font-semibold block mb-2">Destination café</label><select id="library-target" className="manager-select w-full" value={target?.id || ''} disabled={importing.isPending || publish.isPending || !targets.data?.length} onChange={e => { setTargetId(e.target.value); setResult(null); }}>
          {!targets.data?.length && <option value="">No café set up</option>}{targets.data?.map(t => <option key={t.id} value={t.id}>{t.name} · {t.currency}</option>)}
        </select>
        <div className="library-drop-hint"><ArrowDownToLine size={23}/><span>{validSelection.length ? `${itemCount(validSelection.length)} ready to add` : 'Drag items here, or select cards'}</span></div>
        <Button className="w-full" disabled={!target || !validSelection.length || importing.isPending || publish.isPending} onClick={() => openReview(validSelection)}>Review & add {validSelection.length > 0 ? itemCount(validSelection.length) : 'items'}</Button>
        <p className="library-destination-note">Names, photos and price options are copied. Matching names in the same category are skipped.</p>
        {result && <div className="library-result" role="status"><Check size={16}/><div><strong>{result.added} added · {result.skipped} skipped</strong><Link href={user?.role === 'super_admin' ? `/super-admin/restaurant/${target?.id}` : '/admin/menu'}>Open café menu editor →</Link></div></div>}
        <details className="library-publish"><summary>Save café menu to library</summary><p>Save or refresh {target?.name || 'your café'}’s entire menu in the shared library.</p><Button variant="outline" className="w-full" disabled={!target || publish.isPending || importing.isPending} onClick={() => publish.mutate()}><BookmarkPlus size={15} className="mr-2"/>{publish.isPending ? `Saving ${transferProgress?.done || 0} of ${transferProgress?.total || 0}…` : 'Save this café’s menu'}</Button>{publish.isPending && <p role="status">Keep this page open while your menu is saved.</p>}</details>
        {!target && <Link href="/admin/restaurant" className="text-sm text-primary underline">Set up your café →</Link>}
      </aside>
    </div>
    {dragLabel && <div className="library-drag-label" style={{ left: dragLabel.x + 15, top: dragLabel.y + 15 }} aria-hidden="true"><ArrowDownToLine size={14}/>{dragLabel.count} items</div>}
    <Dialog open={reviewIds !== null} onOpenChange={open => { if (!open && !importing.isPending) setReviewIds(null); }}><DialogContent className="manager-editor library-review"><DialogHeader><DialogTitle>Add {itemCount(review.length)} to {target?.name}</DialogTitle><DialogDescription>These will be independent café items. You can edit prices, photos and offers afterwards.</DialogDescription></DialogHeader>
      <div className="library-review-list">{review.map(i => <div key={i.id}><span>{i.name}<small>{i.variants.length ? i.variants.map(v => `${v.label}: ${managerMoney(v.price, i.currency)}`).join(' · ') : i.categoryTitle}</small></span><b>{managerMoney(i.price, i.currency)}</b></div>)}</div>
      <label className="text-sm font-medium" htmlFor="library-import-category">Destination category</label><select id="library-import-category" className="manager-select w-full" disabled={importing.isPending} value={destinationCategory} onChange={e => setDestinationCategory(e.target.value)}><option value="auto">Use library categories (create missing)</option>{target?.categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      {currencyDifference && <div className="library-currency"><p>Source prices use {Array.from(new Set(review.map(i => i.currency))).join(', ')}. {target?.name} uses {target?.currency}.</p><label><input type="checkbox" checked={acceptCurrency} disabled={importing.isPending} onChange={e => setAcceptCurrency(e.target.checked)}/><span>Copy the same price numbers into {target?.currency}. I’ll review prices; no currency conversion is applied.</span></label></div>}
      <label className="library-check"><input type="checkbox" checked={visible} disabled={importing.isPending} onChange={e => setVisible(e.target.checked)}/><span>Show these items on the customer menu immediately<small>Leave unchecked to review hidden items first. Discounts and today’s specials start empty.</small></span></label>
      {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      {importing.isPending && <p role="status" className="text-sm">Adding {transferProgress?.done || 0} of {transferProgress?.total || 0}. Keep this page open.</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={importing.isPending} onClick={() => setReviewIds(null)}>Cancel</Button><Button disabled={importing.isPending || publish.isPending || !review.length || (currencyDifference && !acceptCurrency)} onClick={() => { setFormError(''); importing.mutate(); }}>{importing.isPending ? 'Adding items…' : `Add ${itemCount(review.length)}`}</Button></div>
    </DialogContent></Dialog>
    <Dialog open={!!removing} onOpenChange={open => { if (!open && !remove.isPending) setRemoving(null); }}><DialogContent><DialogHeader><DialogTitle>Remove {removing?.name} from library?</DialogTitle><DialogDescription>Copies already added to café menus will stay. Saving the source café menu again restores this template.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={remove.isPending} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>{remove.isPending ? 'Removing…' : 'Remove template'}</Button></div></DialogContent></Dialog>
  </div>;
}
