import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { notifySessionChanged } from '@/lib/sessionSync';
import { StaffBrand } from '@/components/staff-brand';
import { StaffThemeToggle } from '@/components/staff-theme';
import e3Icon from '@/assets/brand/e3-icon.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}), credentials:'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      setPassword(''); queryClient.clear(); notifySessionChanged();
      window.location.href = data.user?.role === 'super_admin' ? '/super-admin' : '/admin';
    } catch(error) {
      toast({variant:'destructive',title:'Could not sign in',description:error instanceof Error ? error.message : 'Please try again.'});
    } finally { setIsLoading(false); }
  };
  return <div className="staff-login">
    <header className="staff-login-top"><StaffThemeToggle/><span>E3 · Café operations</span></header>
    <main className="staff-login-stage">
      <img className="staff-login-watermark" src={e3Icon} alt="" aria-hidden="true"/>
      <section className="staff-login-card" aria-labelledby="staff-login-title">
        <StaffBrand/>
        <h1 id="staff-login-title">Welcome back.</h1>
        <p className="staff-login-description">Your cafés. Your people. One place.<br/>Sign in to your workspace.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="email">Email address</Label><div className="relative"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input id="email" name="email" type="email" autoComplete="username" placeholder="Your work email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={isLoading} className="pl-10" data-testid="input-email"/></div></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input id="password" name="password" type={visible?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={isLoading} className="pl-10 pr-12" data-testid="input-password"/><button type="button" className="staff-password-toggle" disabled={isLoading} onClick={()=>setVisible(v=>!v)} aria-label={visible?'Hide password':'Show password'} aria-pressed={visible}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
          <Button type="submit" className="staff-sign-in" disabled={isLoading} data-testid="button-login-submit">{isLoading?<><Loader2 className="animate-spin"/>Signing in…</>:<>Sign in to workspace<ArrowRight/></>}</Button>
        </form>
        <p className="staff-login-help">Need access? Contact your restaurant administrator.</p>
      </section>
    </main>
    <footer className="staff-login-footer">E3 CAFÉ OPERATIONS · STAFF ACCESS</footer>
  </div>;
}
