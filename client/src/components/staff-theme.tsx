import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
type Mode = 'dark' | 'light';
const StaffTheme = createContext<{ mode: Mode; toggle: () => void } | null>(null);
export function StaffThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try { return localStorage.getItem('cafe.staff.appearance') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  useLayoutEffect(() => {
    // Body scope also reaches Radix portals (dialogs, selects and mobile nav).
    // Remove it when switching to a customer menu, whose café theme stays local.
    document.body.classList.add('staff-surface');
    document.body.dataset.staffTheme = mode;
    try { localStorage.setItem('cafe.staff.appearance', mode); } catch { /* Optional preference storage. */ }
    return () => { document.body.classList.remove('staff-surface'); delete document.body.dataset.staffTheme; };
  }, [mode]);
  return <StaffTheme.Provider value={{ mode, toggle: () => setMode(m => m === 'dark' ? 'light' : 'dark') }}>{children}</StaffTheme.Provider>;
}
export function StaffThemeToggle() {
  const theme = useContext(StaffTheme);
  if (!theme) return null;
  return <Button variant="ghost" size="icon" className="staff-theme-toggle" onClick={theme.toggle} aria-label={`Switch to ${theme.mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme.mode === 'dark' ? 'light' : 'dark'} mode`}>{theme.mode === 'dark' ? <Sun/> : <Moon/>}</Button>;
}
