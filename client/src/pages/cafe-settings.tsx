import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation } from 'wouter';
export default function CafeSettings() {
  const { user } = useAuth();
  const [location] = useLocation();
  const platformAccount = location === '/super-admin/account';
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [repeatPassword, setRepeat] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== repeatPassword) return toast({ title: 'Passwords do not match', variant: 'destructive' });
    setBusy(true);
    try { await apiRequest('PUT', '/api/account/password', { currentPassword, newPassword }); setCurrent(''); setNew(''); setRepeat(''); toast({ title: 'Password changed' }); }
    catch(e) { toast({ title: 'Could not change password', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  async function clearMenu() {
    if (!window.confirm('Permanently clear all categories, items, discounts, specials, and price options for this café?')) return;
    setBusy(true);
    try { await apiRequest('DELETE', '/api/cafe-menu', { confirmation }); await queryClient.invalidateQueries(); setConfirmation(''); toast({ title: 'Menu cleared' }); }
    catch(e) { toast({ title: 'Could not clear menu', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  async function exportMenu() {
    setBusy(true);
    try {
      const response = await apiRequest('GET','/api/cafe-backup');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'cafe-menu-backup.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e) { toast({ title: 'Could not export menu', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl space-y-6">
    <h1 className="text-3xl font-semibold">{platformAccount ? 'My super admin account' : 'Account & backup'}</h1>
    {(user?.role !== 'super_admin' || platformAccount) && <Card><CardHeader><CardTitle>Change your password</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground mb-4">Signed-in account: {user?.email}</p><form onSubmit={changePassword} className="space-y-3">
      <Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrent(e.target.value)} />
      <Label htmlFor="new-password">New password (at least 10 characters)</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={newPassword} onChange={e => setNew(e.target.value)} />
      <Label htmlFor="repeat-password">Confirm new password</Label><Input id="repeat-password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={repeatPassword} onChange={e => setRepeat(e.target.value)} />
      <Button disabled={busy}>Change password</Button>
    </form></CardContent></Card>}
    {!platformAccount && user?.role === 'super_admin' && user.cafeContext && <Card><CardHeader><CardTitle>Café manager account</CardTitle></CardHeader><CardContent className="space-y-3"><p>{user.cafeContext.owner?.email}</p><Link href={`/super-admin/restaurant/${user.cafeContext.id}`}><Button variant="outline">Open manager account controls</Button></Link></CardContent></Card>}
    {!platformAccount && <><Card><CardHeader><CardTitle>Export menu data</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-muted-foreground">Download your café profile, categories, items, and pricing as JSON. Photos are stored separately on the café server.</p><Button variant="outline" disabled={busy} onClick={exportMenu}>Download menu export</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Start with an empty menu</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-muted-foreground">This permanently removes your café's categories and menu items. Export your menu first if you need a copy.</p><Label htmlFor="clear-confirmation">Type CLEAR MENU to confirm</Label><Input id="clear-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button variant="destructive" disabled={busy || confirmation !== 'CLEAR MENU'} onClick={clearMenu}>Clear café menu</Button></CardContent></Card></>}
  </div>;
}
