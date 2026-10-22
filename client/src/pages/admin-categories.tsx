import { useState } from 'react';
import { Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useManagerMenu, refreshCafe } from '@/lib/managerMenu';
import { categoryEmoji } from '@/lib/menuPalette';
import type { Category } from '@shared/schema';
export default function AdminCategories() {
  const query = useManagerMenu(), { toast } = useToast();
  const [editor, setEditor] = useState<{ id?: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const data = query.data, cafe = data?.restaurant;
  const cats = [...(data?.categories || [])].sort((a,b) => a.order - b.order || a.title.localeCompare(b.title));
  const count = (id: string) => data?.items.filter(i => i.categoryId === id).length || 0;
  const fail = (e: Error) => toast({ title: 'Could not update categories', description: e.message, variant: 'destructive' });
  const save = useMutation({ mutationFn: async () => {
    if (!editor || !cafe) return;
    const title = editor.title.trim();
    if (!title) throw new Error('Enter a category name.');
    if (cats.some(c => c.id !== editor.id && c.title.toLowerCase() === title.toLowerCase())) throw new Error('A category with this name already exists.');
    await apiRequest(editor.id ? 'PUT' : 'POST', editor.id ? `/api/categories/${editor.id}` : '/api/categories', { title, ...(editor.id ? {} : { restaurantId: cafe.id, order: Math.max(-1,...cats.map(c => c.order)) + 1 }) });
  }, onSuccess: async () => { setEditor(null); await refreshCafe(); toast({ title: 'Category saved' }); }, onError: (e: Error) => setError(e.message) });
  const remove = useMutation({ mutationFn: (id: string) => apiRequest('DELETE', `/api/categories/${id}`), onSuccess: async () => { setDeleting(null); await refreshCafe(); toast({ title: 'Category removed' }); }, onError: fail });
  const reorder = useMutation({ mutationFn: (ids: string[]) => apiRequest('PUT', '/api/category-order', { ids }), onSuccess: () => refreshCafe(), onError: fail });
  function move(index: number, step: number) { const ids = cats.map(c => c.id); [ids[index],ids[index + step]] = [ids[index + step],ids[index]]; reorder.mutate(ids); }
  if (query.isLoading) return <p role="status">Loading categories…</p>;
  if (query.isError) return <div className="manager-panel p-8">Could not load categories. <Button onClick={() => query.refetch()}>Try again</Button></div>;
  if (!cafe) return <div className="manager-panel p-8"><Link href="/admin/restaurant">Create your café profile first →</Link></div>;
  return <div className="space-y-6"><div className="manager-section-heading"><div><p className="manager-eyebrow">ORGANIZE YOUR COLLECTION</p><h1 className="text-3xl font-bold">Menu categories</h1><p className="text-muted-foreground">{cats.length} categories · {data?.items.length} items. This order appears on your customer menu.</p></div><Button onClick={() => { setError(''); setEditor({ title: '' }); }}><Plus className="w-4 h-4 mr-2"/>Create category</Button></div><div className="manager-panel p-3 sm:p-6 space-y-2">{cats.map((c,index) => <div className="manager-category-row" key={c.id}><span className="manager-category-number">{String(index+1).padStart(2,'0')}</span><span className="text-2xl" aria-hidden="true">{categoryEmoji(c.title)}</span><div className="flex-1 min-w-0"><h2 className="font-semibold">{c.title}</h2><p className="text-xs text-muted-foreground">{count(c.id)} items · {data?.items.filter(i => i.categoryId === c.id && i.isAvailable).length || 0} visible</p></div><div className="flex flex-wrap gap-1"><Button variant="ghost" size="icon" aria-label={`Move ${c.title} up`} disabled={index === 0 || reorder.isPending || remove.isPending} onClick={() => move(index,-1)}><ArrowUp className="w-4 h-4"/></Button><Button variant="ghost" size="icon" aria-label={`Move ${c.title} down`} disabled={index === cats.length-1 || reorder.isPending || remove.isPending} onClick={() => move(index,1)}><ArrowDown className="w-4 h-4"/></Button><Button variant="ghost" size="icon" aria-label={`Rename ${c.title}`} onClick={() => { setError(''); setEditor({ id: c.id, title: c.title }); }}><Pencil className="w-4 h-4"/></Button><Button variant="ghost" size="icon" aria-label={`Remove category ${c.title}`} onClick={() => setDeleting(c)}><Trash2 className="w-4 h-4"/></Button></div></div>)}{!cats.length && <div className="p-8 text-center"><h2 className="font-semibold">Give your menu a little structure</h2><p className="text-muted-foreground">Create categories such as Coffee, Breakfast, or Desserts.</p></div>}</div><Dialog open={!!editor} onOpenChange={open => { if (!open && !save.isPending) setEditor(null); }}><DialogContent><DialogHeader><DialogTitle>{editor?.id ? 'Rename category' : 'Create category'}</DialogTitle><DialogDescription>A clear category name helps guests find their favorites.</DialogDescription></DialogHeader><form onSubmit={e => { e.preventDefault(); setError(''); save.mutate(); }} className="space-y-4"><Label htmlFor="category-name">Category name</Label><Input id="category-name" required maxLength={100} autoFocus value={editor?.title || ''} onChange={e => setEditor(prev => prev ? { ...prev, title: e.target.value } : prev)}/>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save category'}</Button></div></form></DialogContent></Dialog><Dialog open={!!deleting} onOpenChange={open => { if (!open && !remove.isPending) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Remove {deleting?.title}?</DialogTitle><DialogDescription>This permanently removes this category and its {deleting ? count(deleting.id) : 0} menu items, including all price options. Move items to another category first if you want to keep them.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{remove.isPending ? 'Removing…' : 'Remove category'}</Button></div></DialogContent></Dialog></div>;
}
