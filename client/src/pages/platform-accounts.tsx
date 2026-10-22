import { useState } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users, Search, Plus, Snowflake, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OpenCafeAccount } from '@/components/open-cafe-account';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { notifySessionChanged } from '@/lib/sessionSync';
import type { Restaurant, User } from '@shared/schema';

type Account = Omit<User, 'password'>;
type Action = 'freeze'|'unfreeze'|'delete'|'restore';
const emptyForm = { email:'', firstName:'', lastName:'', password:'', role:'admin', restaurantName:'' };
const actionLabels = { freeze:'Freeze account', unfreeze:'Unfreeze account', delete:'Delete account', restore:'Restore account' };
export default function PlatformAccounts() {
  const { user } = useAuth(), { toast } = useToast();
  const accounts = useQuery<Account[]>({ queryKey: ['/api/super-admin/users'] });
  const cafes = useQuery<Restaurant[]>({ queryKey: ['/api/super-admin/restaurants'] });
  const [search, setSearch] = useState(''), [status, setStatus] = useState('current');
  const [editor, setEditor] = useState<Account|'new'|null>(null), [form, setForm] = useState(emptyForm);
  const [action, setAction] = useState<{account:Account;type:Action}|null>(null);
  const [confirmation, setConfirmation] = useState(''), [error, setError] = useState('');
  const refresh = () => Promise.all([queryClient.invalidateQueries({queryKey:['/api/super-admin/users']}),queryClient.invalidateQueries({queryKey:['/api/super-admin/restaurants']})]);
  const save = useMutation({ mutationFn: async () => {
    if (!editor) throw new Error('Choose an account');
    const body = { email:form.email, firstName:form.firstName, lastName:form.lastName, role:form.role, ...(form.password ? {password:form.password} : {}) };
    if (editor === 'new') await apiRequest('POST','/api/super-admin/users',{...body,password:form.password,...(form.role === 'admin' ? {restaurantName:form.restaurantName} : {})});
    else await apiRequest('PUT',`/api/super-admin/users/${editor.id}`,body);
  }, onSuccess: async () => {
    const ownSecurityChange = !!editor && editor !== 'new' && editor.id === user?.id && (form.password || form.role !== editor.role);
    setEditor(null); setForm(emptyForm);
    if (ownSecurityChange) { queryClient.clear(); notifySessionChanged(); window.location.href='/login'; return; }
    await refresh(); toast({title:'Account saved',description:'Manager accounts control their café. Super admins manage the whole platform.'});
  }, onError:(e:Error)=>setError(e.message) });
  const change = useMutation({ mutationFn: async () => {
    if (!action) throw new Error('Choose an account action');
    if (action.type === 'delete' && confirmation !== action.account.email) throw new Error('Enter the account email to confirm deletion');
    await apiRequest(action.type === 'delete' ? 'DELETE' : 'POST', `/api/super-admin/users/${action.account.id}${action.type === 'delete' ? '' : '/'+action.type}`,{});
  }, onSuccess: async () => {
    const type=action?.type; setAction(null); setConfirmation(''); await refresh();
    toast({title:type === 'delete' ? 'Account deleted' : type === 'freeze' ? 'Account frozen' : type === 'restore' ? 'Account restored' : 'Account unfrozen',description:'The café menu and permanent QR code are preserved.'});
  }, onError:(e:Error)=>setError(e.message) });
  const openAction = (account:Account,type:Action) => { setAction({account,type}); setError(''); setConfirmation(''); };
  const openEditor = (account:Account|'new') => {setEditor(account);setError('');setForm(account === 'new' ? {...emptyForm} : {...emptyForm,email:account.email,firstName:account.firstName || '',lastName:account.lastName || '',role:account.role});};
  if (accounts.isLoading || cafes.isLoading) return <div className="manager-panel p-8" role="status">Loading accounts…</div>;
  if (accounts.isError || cafes.isError) return <div className="manager-panel p-8">Could not load accounts. <Button onClick={() => { accounts.refetch(); cafes.refetch(); }}>Try again</Button></div>;
  const all = accounts.data || [], activeAdmins = all.filter(a=>a.role === 'super_admin' && a.accountStatus === 'active').length;
  const filtered = all.filter(a => (status === 'current' ? a.accountStatus !== 'deleted' : a.accountStatus === status) && `${a.email} ${a.firstName || ''} ${a.lastName || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div className="manager-section-heading"><div><p className="manager-eyebrow">PLATFORM / ACCOUNTS</p><h1 className="text-3xl font-bold flex gap-3 items-center"><Users className="text-primary"/>Accounts & roles</h1><p className="text-sm text-muted-foreground mt-2">Add users, manage permissions, and control sign-in access.</p></div><Button onClick={()=>openEditor('new')}><Plus size={16} className="mr-2"/>Add account</Button></div>
    <div className="manager-panel p-5 flex gap-3"><ShieldCheck className="text-primary shrink-0" size={21}/><p className="text-sm text-muted-foreground">Café managers manage their own café. Super admins manage every café and user. Freezing an account blocks sign-in immediately; customer menus stay available.</p></div>
    <div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground"/><Input aria-label="Search accounts" className="pl-9" placeholder="Find an account…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Account status filter" className="manager-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="current">Current accounts</option><option value="active">Active accounts</option><option value="frozen">Frozen accounts</option><option value="deleted">Deleted accounts</option></select></div>
    <div className="space-y-3">{filtered.map(account=>{
      const cafe=cafes.data?.find(c=>c.userId===account.id);
      const protectedAccount=account.id===user?.id || (account.role==='super_admin' && account.accountStatus==='active' && activeAdmins<=1);
      return <article key={account.id} className="manager-panel p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0"><h2 className="font-bold text-sm break-all">{account.email}{account.id===user?.id && <span className="manager-chip ml-2">You</span>}</h2><p className="text-xs text-muted-foreground mt-2">{[account.firstName,account.lastName].filter(Boolean).join(' ') || 'Account'} · {cafe?.name || 'Platform account'}</p><div className="flex flex-wrap gap-2 mt-3"><span className="manager-chip">{account.role==='super_admin' ? 'Super admin' : 'Café manager'}</span><span className={`manager-chip ${account.accountStatus!=='active' ? 'text-destructive' : ''}`}>{account.accountStatus==='frozen' ? 'Frozen' : account.accountStatus==='deleted' ? 'Deleted' : 'Active'}</span></div></div>
        <div className="flex flex-wrap gap-2">{cafe && <OpenCafeAccount id={cafe.id} name={cafe.name}/>}
          {account.accountStatus==='deleted' ? <Button size="sm" variant="outline" aria-label={`Restore ${account.email}`} onClick={()=>openAction(account,'restore')}><RotateCcw size={14} className="mr-2"/>Restore</Button> : <>
            <Button size="sm" variant="outline" aria-label={`Edit ${account.email}`} onClick={()=>openEditor(account)}>Edit account</Button>
            <Button size="sm" variant="outline" disabled={protectedAccount} title={protectedAccount ? 'Your account and the last active super admin are protected' : undefined} aria-label={`${account.accountStatus==='frozen' ? 'Unfreeze' : 'Freeze'} ${account.email}`} onClick={()=>openAction(account,account.accountStatus==='frozen' ? 'unfreeze' : 'freeze')}><Snowflake size={14} className="mr-2"/>{account.accountStatus==='frozen' ? 'Unfreeze' : 'Freeze'}</Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={protectedAccount} aria-label={`Delete ${account.email}`} onClick={()=>openAction(account,'delete')}><Trash2 size={14} className="mr-2"/>Delete</Button>
          </>}{cafe && <Link href={`/super-admin/restaurant/${cafe.id}`}><Button variant="ghost" size="sm">Café controls</Button></Link>}</div>
      </article>;
    })}{!filtered.length && <div className="manager-panel p-8 text-muted-foreground">No accounts match this view.</div>}</div>
    <Dialog open={!!editor} onOpenChange={open=>{if(!open && !save.isPending){setEditor(null);setForm(emptyForm);}}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editor==='new' ? 'Add account' : 'Edit account'}</DialogTitle><DialogDescription>{editor==='new' ? 'Create manager access with a new restaurant, or add a platform administrator.' : 'Role and password changes sign this account out. At least one active super admin must remain.'}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();save.mutate();}}>
        <fieldset disabled={save.isPending} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="user-first">First name</Label><Input id="user-first" value={form.firstName} required maxLength={100} onChange={e=>setForm({...form,firstName:e.target.value})}/></div><div><Label htmlFor="user-last">Last name</Label><Input id="user-last" value={form.lastName} required maxLength={100} onChange={e=>setForm({...form,lastName:e.target.value})}/></div></div>
        <div><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" value={form.email} required maxLength={254} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div><Label htmlFor="user-role">Role</Label><select id="user-role" className="manager-select w-full" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="admin">Café manager</option><option value="super_admin">Super admin</option></select></div>
        {form.role==='super_admin' && <p className="text-sm text-muted-foreground">This grants full access to every café, account and platform control.</p>}
        {editor==='new' && form.role==='admin' && <div><Label htmlFor="user-restaurant">New restaurant name</Label><Input id="user-restaurant" required maxLength={150} value={form.restaurantName} onChange={e=>setForm({...form,restaurantName:e.target.value})}/><p className="text-xs text-muted-foreground mt-2">Creates one café with its own permanent menu QR. For an existing café, edit its current manager account.</p></div>}
        <div><Label htmlFor="user-password">{editor==='new' ? 'Password' : 'New password (optional)'}</Label><Input id="user-password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required={editor==='new'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><p className="text-xs text-muted-foreground mt-2">{editor==='new' ? 'Use at least 10 characters. Share the login details privately.' : 'Leave blank to keep the current password.'}</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={()=>{setEditor(null);setForm(emptyForm);}}>Cancel</Button><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : editor==='new' ? 'Create account' : 'Save account'}</Button></div>
        </fieldset>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!action} onOpenChange={open=>{if(!open && !change.isPending)setAction(null);}}><DialogContent><DialogHeader><DialogTitle>{action ? actionLabels[action.type] : 'Account action'}</DialogTitle><DialogDescription>{action?.account.email}</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">{action?.type==='delete' ? 'This removes sign-in access and signs out all devices. The café, menu, photos and permanent QR remain. You can restore the user from Deleted accounts.' : action?.type==='freeze' ? 'The user will be signed out on all devices and cannot sign in until you unfreeze the account. Their customer menu remains available.' : 'Sign-in access will be restored. The user must sign in again; previous sessions stay signed out.'}</p>
      {action?.type==='delete' && <div><Label htmlFor="delete-email">Type the account email to confirm</Label><Input id="delete-email" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={change.isPending} onClick={()=>setAction(null)}>Cancel</Button><Button variant={action?.type==='delete' ? 'destructive' : 'default'} disabled={change.isPending || (action?.type==='delete' && confirmation!==action.account.email)} onClick={()=>change.mutate()}>{change.isPending ? 'Updating…' : action ? actionLabels[action.type] : 'Confirm'}</Button></div>
    </DialogContent></Dialog>
  </div>;
}
