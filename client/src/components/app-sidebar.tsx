import { LayoutDashboard, UtensilsCrossed, FolderOpen, Store, QrCode, LogOut, Building2, LibraryBig, Users, History } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@shared/schema";
import { logout } from '@/lib/logout';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { StaffBrand } from '@/components/staff-brand';

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Café Profile & Theme",
    url: "/admin/restaurant",
    icon: Store,
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: FolderOpen,
  },
  {
    title: "Menu Items",
    url: "/admin/menu",
    icon: UtensilsCrossed,
  },
  { title: "Account & Backup", url: "/admin/settings", icon: Store },
  { title: "Global Menu Library", url: "/admin/library", icon: LibraryBig },
  {
    title: "QR Code",
    url: "/admin/qr-code",
    icon: QrCode,
  },
];

const superAdminMenuItems = [
  { title: "Global Menu Library", url: "/admin/library", icon: LibraryBig },
  {
    title: "Restaurants",
    url: "/super-admin",
    icon: Building2,
  },
  { title: 'Accounts & Roles', url: '/super-admin/accounts', icon: Users },
  { title: 'Access History', url: '/super-admin/access-history', icon: History },
  { title: 'My Account', url: '/super-admin/account', icon: Store },
];

interface AppSidebarProps {
  user?: AuthUser | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  useEffect(() => { if (isMobile) setOpenMobile(false); }, [location, isMobile, setOpenMobile]);
  const isSuperAdmin = user?.role === "super_admin";
  const menuItems = isSuperAdmin ? superAdminMenuItems : adminMenuItems;
  const sidebarTitle = isSuperAdmin ? "Super Admin" : "Café Manager";

  return (
    <Sidebar className="staff-sidebar">
      <SidebarContent>
        <div className="staff-sidebar-brand"><StaffBrand compact/></div>
        <SidebarGroup>
          <SidebarGroupLabel className="staff-nav-label">
            {sidebarTitle}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isSuperAdmin && user?.cafeContext && <SidebarGroup><SidebarGroupLabel className="px-4 text-primary font-bold truncate">Café workspace · {user.cafeContext.name}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{adminMenuItems.filter(i => i.url !== '/admin/library').map(item => <SidebarMenuItem key={item.url}><SidebarMenuButton asChild isActive={location === item.url}><Link href={item.url}><item.icon/><span>{item.title}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="staff-sidebar-account"><span>{(user?.firstName?.[0] || user?.email?.[0] || 'M').toUpperCase()}</span><div><strong>{user?.firstName || 'Your account'}</strong><small>{sidebarTitle}</small></div></div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          disabled={loggingOut}
          onClick={async () => { setLoggingOut(true); try { await logout(); } catch(e) { setLoggingOut(false); toast({ title: 'Could not sign out', description: (e as Error).message, variant: 'destructive' }); } }}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
