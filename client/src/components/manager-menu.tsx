import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Plus, Pencil, Trash2, Search, ImagePlus, X, LibraryBig, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cafeDate } from '@/lib/cafeTheme';
import { useManagerMenu, updateManagerMenu, refreshCafe, managerMoney, uploadMedia } from '@/lib/managerMenu';
import { categoryEmoji } from '@/lib/menuPalette';
import { matchesMenuSearch, menuSearchIndex, menuSearchQuery } from '@/lib/menuSearch';
import { menuModifierGroupsSchema, type MenuItem, type PriceVariant, type MenuModifierGroup } from '@shared/schema';
import ModifierEditor from '@/components/menu/ModifierEditor';
import '@/components/menu/menu-modifiers.css';
type Option = Pick<PriceVariant, 'label' | 'price' | 'discount' | 'unit'>;
type Draft = { name: string; description: string; categoryId: string; price: string; discount: string; unit: string; imageUrl: string; isAvailable: boolean; specialDate: string; hasMultiplePricing: boolean; tags: string[]; variants: Option[]; modifierGroups: MenuModifierGroup[] };
const tags = ['Bestseller', 'New', 'Spicy', 'Vegetarian', 'Vegan', 'Gluten-Free'];
const blank = (categoryId: string): Draft => ({ name: '', description: '', categoryId, price: '', discount: '0', unit: 'serving', imageUrl: '', isAvailable: true, specialDate: '', hasMultiplePricing: false, tags: [], variants: [], modifierGroups: [] });
export function ManagerMenu({ dashboard = false }: { dashboard?: boolean }) {
  const query = useManagerMenu();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<{ id?: string; expectedUpdatedAt?: string; order: number; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const data = query.data, cafe = data?.restaurant;
  const categories = [...(data?.categories || [])].sort((a,b) => a.order - b.order || a.title.localeCompare(b.title));
  const items = data?.items || [], today = cafeDate(cafe?.timezone);
  const optionsByItem = new Map<string, PriceVariant[]>();
  for (const v of data?.variants || []) optionsByItem.set(v.menuItemId, [...(optionsByItem.get(v.menuItemId) || []), v]);
  const hasOffer = (i: MenuItem) => Number(i.discount) > 0 || (optionsByItem.get(i.id) || []).some(v => Number(v.discount) > 0);
  const searchIndexes = useMemo(() => {
    const titles = new Map(data?.categories.map(c => [c.id, c.title]) || []);
    const labels = new Map<string, string[]>();
    for (const v of data?.variants || []) labels.set(v.menuItemId, [...(labels.get(v.menuItemId) || []), v.label]);
    return new Map((data?.items || []).map(i => [i.id, menuSearchIndex(i, titles.get(i.categoryId) || '', [...(labels.get(i.id) || []), ...(i.modifierGroups || []).flatMap(g => [g.title, g.titleAr || '', ...g.options.flatMap(o => [o.label, o.labelAr || ''])])])]));
  }, [data?.items, data?.categories, data?.variants]);
  const searchQuery = menuSearchQuery(search);
  const filtered = items.filter(i => (category === 'all' || i.categoryId === category) && matchesMenuSearch(searchIndexes.get(i.id) || [], searchQuery) && (status === 'all' || status === 'visible' && i.isAvailable || status === 'hidden' && !i.isAvailable || status === 'special' && i.specialDate === today || status === 'discount' && hasOffer(i)));
  const update = (values: Partial<Draft>) => setEditor(prev => prev ? { ...prev, draft: { ...prev.draft, ...values } } : prev);
  const updateOption = (index: number, field: keyof Option, value: string) => setEditor(prev => prev ? { ...prev, draft: { ...prev.draft, variants: prev.draft.variants.map((v,n) => n === index ? { ...v, [field]: value } : v) } } : prev);
  const fail = (error: Error) => toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
  const publish = useMutation({ mutationFn: async () => {
    if (!cafe) throw new Error('Set up your café first.');
    let saved = 0; setSavedCount(0);
    try {
      for (const item of items) {
        const result = await (await apiRequest('POST', '/api/menu-library/publish', { restaurantId: cafe.id, itemIds: [item.id] })).json();
        saved += result.saved; setSavedCount(saved);
      }
      return { saved };
    } catch (error) { await refreshCafe('library'); throw new Error(`${saved} items saved. You can retry safely. ${(error as Error).message}`); }
  }, onSuccess: async ({ saved }) => { await refreshCafe('library'); toast({ title: `${saved} items saved to the global library`, description: 'Photos and price options are ready to reuse in other cafés.' }); }, onError: fail });
  const save = useMutation({ mutationKey: ['cafe-menu-write'], mutationFn: async () => {
    if (!editor) return;
    const { variants, ...draft } = editor.draft;
    const positive = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 99999999.99;
    const discountOK = (v: string | null) => positive(v || '0') && Number(v || 0) <= 100;
    if (!draft.name.trim() || !draft.categoryId) throw new Error('Enter a name and choose a category.');
    if (draft.hasMultiplePricing ? !variants.length || variants.some(v => !v.label.trim() || !positive(v.price) || !discountOK(v.discount) || !v.unit.trim()) : !positive(draft.price) || !discountOK(draft.discount)) throw new Error('Enter a valid price and a discount between 0 and 100 for each option.');
    if (draft.hasMultiplePricing && new Set(variants.map(v => v.label.trim().toLowerCase())).size !== variants.length) throw new Error('Give each price option a different name.');
    const modifiers = menuModifierGroupsSchema.safeParse(draft.modifierGroups);
    if (!modifiers.success) throw new Error('Check toppings and choices: '+modifiers.error.issues.map(issue => issue.message).join(', '));
    draft.modifierGroups = modifiers.data;
    return (await apiRequest('POST', '/api/manager-menu', { id: editor.id, expectedUpdatedAt: editor.expectedUpdatedAt, item: { ...draft, name: draft.name.trim(), price: draft.hasMultiplePricing ? Math.min(...variants.map(v => Number(v.price))) : Number(draft.price), discount: draft.hasMultiplePricing ? 0 : Number(draft.discount || 0), specialDate: draft.specialDate || null, order: editor.order }, variants: draft.hasMultiplePricing ? variants.map(v => ({ ...v, label: v.label.trim() })) : [] })).json() as Promise<MenuItem & { variants: PriceVariant[] }>;
  }, onMutate: () => queryClient.cancelQueries({ queryKey: ['/api/manager-menu'] }), onSuccess: result => {
    if (!result) return;
    const { variants, ...item } = result;
    updateManagerMenu(data => ({ ...data, items: data.items.some(i => i.id === item.id) ? data.items.map(i => i.id === item.id ? item : i) : [...data.items, item], variants: [...data.variants.filter(v => v.menuItemId !== item.id), ...variants] }));
    setEditor(null); void refreshCafe(); toast({ title: 'Menu saved', description: 'Your customer menu is updated.' });
  }, onError: (error: Error) => setFormError(error.message) });
  const remove = useMutation({ mutationKey: ['cafe-menu-write'], mutationFn: (id: string) => apiRequest('DELETE', `/api/menu-items/${id}`), onMutate: () => queryClient.cancelQueries({ queryKey: ['/api/manager-menu'] }), onSuccess: (_result, id) => {
    updateManagerMenu(data => ({ ...data, items: data.items.filter(i => i.id !== id), variants: data.variants.filter(v => v.menuItemId !== id) }));
    setDeleting(null); void refreshCafe(); toast({ title: 'Item removed' });
  }, onError: fail });
  const visibility = useMutation({ mutationKey: ['cafe-menu-write'], mutationFn: async ({ id, available }: { id: string; available: boolean }) => (await apiRequest('PUT', `/api/menu-items/${id}`, { isAvailable: available })).json() as Promise<MenuItem>,
    onMutate: async ({ id, available }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/manager-menu'] });
      const previous = queryClient.getQueryData<import('@/lib/managerMenu').ManagerMenuData>(['/api/manager-menu'])?.items.find(i => i.id === id);
      updateManagerMenu(data => ({ ...data, items: data.items.map(i => i.id === id ? { ...i, isAvailable: available } : i) }));
      return { previous };
    }, onSuccess: item => updateManagerMenu(data => ({ ...data, items: data.items.map(i => i.id === item.id ? item : i) })),
    onError: (error, _variables, context) => { if (context?.previous) updateManagerMenu(data => ({ ...data, items: data.items.map(i => i.id === context.previous!.id ? context.previous! : i) })); fail(error); },
    onSettled: () => { void refreshCafe(); }
  });
  function edit(item: MenuItem) { setFormError(''); setEditor({ id: item.id, expectedUpdatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined, order: item.order, draft: { name: item.name, description: item.description || '', categoryId: item.categoryId, price: item.price, discount: item.discount || '0', unit: item.unit, imageUrl: item.imageUrl || '', isAvailable: item.isAvailable, specialDate: item.specialDate || '', hasMultiplePricing: item.hasMultiplePricing, tags: item.tags || [], modifierGroups: structuredClone(item.modifierGroups || []), variants: (optionsByItem.get(item.id) || []).sort((a,b) => a.order - b.order).map(({ label, price, discount, unit }) => ({ label, price, discount, unit })) } }); }
  if (query.isLoading) return <div className="manager-panel p-8" role="status">Loading your complete menu…</div>;
  if (query.isError) return <div className="manager-panel p-8">Could not load your menu. <Button onClick={() => query.refetch()}>Try again</Button></div>;
  if (!cafe) return <div className="manager-panel p-8"><h2>Set up your café</h2><Link href="/admin/restaurant">Add your café profile to get started →</Link></div>;
  const d = editor?.draft;
  return <section className="space-y-5" aria-label="Complete café menu">
    <div className="manager-section-heading"><div><p className="manager-eyebrow">YOUR MENU COLLECTION</p><h2 className="text-2xl font-bold">{dashboard ? 'Complete café menu' : 'Menu editor'}</h2><p className="text-muted-foreground text-sm">{items.length} items · {categories.length} categories · Changes appear on your live menu.</p>{publish.isPending && <p role="status">Saving {savedCount} of {items.length}. Keep this page open.</p>}</div><div className="flex flex-wrap gap-2"><Link href="/admin/library"><Button variant="outline"><LibraryBig className="w-4 h-4 mr-2"/>Global library</Button></Link><Button variant="outline" disabled={!items.length || publish.isPending} onClick={() => publish.mutate()}><BookmarkPlus className="w-4 h-4 mr-2"/>{publish.isPending ? 'Saving…' : 'Save to library'}</Button><Button disabled={!categories.length} onClick={() => { setFormError(''); setEditor({ order: Math.max(-1,...items.map(i => i.order)) + 1, draft: blank(category === 'all' ? categories[0]?.id || '' : category) }); }} data-testid="button-add-item"><Plus className="w-4 h-4 mr-2"/>Add menu item</Button></div></div>
    {!categories.length ? <div className="manager-panel p-8"><p>Create your first category before adding items.</p><Link href="/admin/categories" className="text-primary underline">Create category →</Link></div> : <>
    <div className="manager-panel manager-filters"><div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground"/><Input aria-label="Search menu" placeholder="Find an item, description or tag…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9"/></div><select aria-label="Filter by category" className="manager-select" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories ({categories.length})</option>{categories.map(c => <option key={c.id} value={c.id}>{c.title} ({items.filter(i => i.categoryId === c.id).length})</option>)}</select><select aria-label="Filter by status" className="manager-select" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All items</option><option value="visible">Visible</option><option value="hidden">Hidden</option><option value="discount">Discounts</option><option value="special">Today’s specials</option></select></div>
    <p className="text-xs text-muted-foreground" role="status" data-testid="menu-result-count">Showing {filtered.length} of {items.length} items</p>
    {categories.map(c => { const group = filtered.filter(i => i.categoryId === c.id).sort((a,b) => a.order - b.order || a.name.localeCompare(b.name)); return group.length ? <div key={c.id} className="manager-menu-group"><div className="manager-category-heading"><span aria-hidden="true">{categoryEmoji(c.title)}</span><h3>{c.title}</h3><span>{group.length} items</span></div><div className="manager-menu-grid">{group.map(item => { const options = optionsByItem.get(item.id) || []; return <article className={`manager-item ${!item.isAvailable ? 'manager-item-hidden' : ''}`} key={item.id} data-testid={`manager-item-${item.id}`}><div className="manager-item-art">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy"/> : <span aria-hidden="true">{categoryEmoji(c.title)}</span>}</div><div className="manager-item-body"><h4>{item.name}</h4>{item.description && <p className="manager-item-description">{item.description}</p>}<div className="manager-item-price">{item.hasMultiplePricing ? <div>{options.map(v => <span className="block" key={v.id}>{v.label} <b>{managerMoney(Number(v.price) * (1 - Number(v.discount || 0) / 100), cafe.currency)}</b>{Number(v.discount) > 0 && <small> · {v.discount}% off</small>}</span>)}</div> : <><b>{managerMoney(Number(item.price) * (1 - Number(item.discount || 0) / 100), cafe.currency)}</b>{Number(item.discount) > 0 && <><del>{managerMoney(item.price, cafe.currency)}</del><span className="manager-chip">{item.discount}% off</span></>}</>}</div><div className="flex flex-wrap gap-1 mt-2">{item.specialDate && <span className="manager-chip">{item.specialDate === today ? '✦ Today’s special' : `Special · ${item.specialDate}`}</span>}{(item.tags || []).map(t => <span key={t} className="manager-chip">{t}</span>)}</div><div className="manager-item-actions"><label className="flex items-center gap-2 text-xs"><Switch aria-label={`Visible ${item.name}`} checked={item.isAvailable} disabled={visibility.isPending} onCheckedChange={available => visibility.mutate({ id: item.id, available })}/>{item.isAvailable ? 'Visible' : 'Hidden'}</label><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${item.name}`} onClick={() => edit(item)}><Pencil className="w-4 h-4"/></Button><Button variant="ghost" size="icon" aria-label={`Remove ${item.name}`} onClick={() => setDeleting(item)}><Trash2 className="w-4 h-4"/></Button></div></div></div></article>; })}</div></div> : null; })}
    {!filtered.length && <div className="manager-panel p-10 text-center"><h3 className="font-semibold">{items.length ? 'No matching menu items' : 'Your first dish starts here'}</h3><p className="text-muted-foreground">{items.length ? 'Try another search or filter.' : 'Add a menu item with its price and category.'}</p>{items.length > 0 && <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); }}>Clear filters</Button>}</div>}
    </>}
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !save.isPending && !uploading) setEditor(null); }}><DialogContent className="manager-editor max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editor?.id ? 'Edit menu item' : 'Add menu item'}</DialogTitle><DialogDescription>Set the details your guests will see. Save to update your live menu.</DialogDescription></DialogHeader>{d && <form className="space-y-5" onSubmit={e => { e.preventDefault(); setFormError(''); save.mutate(); }}><fieldset disabled={save.isPending || uploading} className="space-y-5">
    <div className="grid sm:grid-cols-2 gap-4"><div><Label htmlFor="item-name">Item name *</Label><Input id="item-name" required maxLength={150} value={d.name} onChange={e => update({ name: e.target.value })}/></div><div><Label htmlFor="item-category">Category *</Label><select id="item-category" className="manager-select w-full" required value={d.categoryId} onChange={e => update({ categoryId: e.target.value })}>{categories.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></div></div>
    <div><Label htmlFor="item-description">Description</Label><Textarea id="item-description" value={d.description} onChange={e => update({ description: e.target.value })} placeholder="Ingredients, taste, serving details…"/></div>
    <div className="manager-editor-box"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">Pricing · {cafe.currency}</h3><p className="text-xs text-muted-foreground">Use options for sizes, portions, or drink choices.</p></div><label className="flex gap-2 items-center text-sm"><Switch checked={d.hasMultiplePricing} onCheckedChange={hasMultiplePricing => update({ hasMultiplePricing, variants: hasMultiplePricing && !d.variants.length ? [{ label: '', price: d.price || '', discount: d.discount, unit: d.unit }] : d.variants })}/>Multiple prices</label></div>
    {d.hasMultiplePricing ? <div className="mt-4 space-y-3">{d.variants.map((v,index) => <div className="manager-option" key={index}><div><Label htmlFor={`option-label-${index}`}>Option {index + 1}</Label><Input id={`option-label-${index}`} required value={v.label} onChange={e => updateOption(index,'label',e.target.value)} placeholder="Single / Double"/></div><div><Label htmlFor={`option-price-${index}`}>Price *</Label><Input id={`option-price-${index}`} type="number" min="0" step="0.01" required value={v.price} onChange={e => updateOption(index,'price',e.target.value)}/></div><div><Label htmlFor={`option-discount-${index}`}>Discount %</Label><Input id={`option-discount-${index}`} type="number" min="0" max="100" step="0.01" value={v.discount || ''} onChange={e => updateOption(index,'discount',e.target.value)}/></div><div><Label htmlFor={`option-unit-${index}`}>Unit</Label><Input id={`option-unit-${index}`} required value={v.unit} onChange={e => updateOption(index,'unit',e.target.value)}/></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove price option ${index+1}`} onClick={() => update({ variants: d.variants.filter((_,n) => n !== index) })}><X className="w-4 h-4"/></Button></div>)}<Button type="button" variant="outline" disabled={d.variants.length >= 3} onClick={() => update({ variants: [...d.variants, { label: '', price: '', discount: '0', unit: 'cup' }] })}><Plus className="w-4 h-4 mr-2"/>Add price option ({d.variants.length}/3)</Button></div> : <div className="grid grid-cols-3 gap-3 mt-4"><div><Label htmlFor="item-price">Price *</Label><Input id="item-price" type="number" min="0" step="0.01" required value={d.price} onChange={e => update({ price: e.target.value })}/></div><div><Label htmlFor="item-discount">Discount %</Label><Input id="item-discount" type="number" min="0" max="100" step="0.01" value={d.discount} onChange={e => update({ discount: e.target.value })}/></div><div><Label htmlFor="item-unit">Unit</Label><Input id="item-unit" required value={d.unit} onChange={e => update({ unit: e.target.value })}/></div></div>}</div>
    <ModifierEditor groups={d.modifierGroups} currency={cafe.currency} onChange={modifierGroups => update({ modifierGroups })}/>
    <div className="manager-editor-box"><Label htmlFor="item-special">Daily special date</Label><div className="flex flex-wrap items-center gap-2 mt-2"><Input className="w-auto flex-1" id="item-special" type="date" value={d.specialDate} onChange={e => update({ specialDate: e.target.value })}/><Button type="button" variant="outline" onClick={() => update({ specialDate: today })}>Today</Button><Button type="button" variant="ghost" onClick={() => update({ specialDate: '' })}>Clear</Button></div><p className="text-xs text-muted-foreground mt-2">Based on {cafe.timezone}. Special badges apply on the selected date.</p></div>
    <div><Label htmlFor="item-photo">Item photo</Label><div className="flex flex-wrap gap-3 items-center mt-2">{d.imageUrl && <img src={d.imageUrl} alt="Item preview" className="w-20 h-20 object-cover rounded-xl"/>}<label className="manager-upload"><ImagePlus className="w-4 h-4"/>{uploading ? 'Uploading…' : 'Choose photo'}<input id="item-photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { update({ imageUrl: await uploadMedia(file) }); } catch (err) { setFormError((err as Error).message); } finally { setUploading(false); } }}/></label>{d.imageUrl && <Button type="button" variant="ghost" onClick={() => update({ imageUrl: '' })}>Remove photo</Button>}</div><p className="text-xs text-muted-foreground mt-2">Up to 5 MB. Photos are saved when you save the item.</p></div>
    <div><Label>Tags</Label><div className="flex flex-wrap gap-2 mt-2">{tags.map(t => <Button type="button" key={t} size="sm" variant={d.tags.includes(t) ? 'default' : 'outline'} aria-pressed={d.tags.includes(t)} onClick={() => update({ tags: d.tags.includes(t) ? d.tags.filter(v => v !== t) : [...d.tags,t] })}>{t}</Button>)}</div></div>
    <label className="flex items-center gap-3"><Switch checked={d.isAvailable} onCheckedChange={isAvailable => update({ isAvailable })}/>Visible on customer menu</label></fieldset>
    {formError && <p role="alert" className="text-destructive text-sm">{formError}</p>}<div className="manager-editor-footer"><Button type="button" variant="outline" disabled={save.isPending || uploading} onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" disabled={save.isPending || uploading}>{save.isPending ? 'Saving…' : 'Save menu item'}</Button></div></form>}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !remove.isPending) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Remove {deleting?.name}?</DialogTitle><DialogDescription>This deletes the item and its price options from your café. Hiding an item keeps it for later.</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{remove.isPending ? 'Removing…' : 'Remove item'}</Button></div></DialogContent></Dialog>
  </section>;
}

