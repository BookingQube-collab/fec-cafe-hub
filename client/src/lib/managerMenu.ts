import { useIsMutating, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Restaurant, Category, MenuItem, PriceVariant } from '@shared/schema';
import { notifyContentChanged } from './sessionSync';
export interface ManagerMenuData { restaurant: Restaurant | null; categories: Category[]; items: MenuItem[]; variants: PriceVariant[] }
export function useManagerMenu() {
  const { isAuthenticated, user } = useAuth();
  const writing = useIsMutating({ mutationKey: ['cafe-menu-write'] }) > 0;
  return useQuery<ManagerMenuData>({ queryKey: ['/api/manager-menu'], enabled: isAuthenticated && (user?.role === 'admin' || !!user?.cafeContext), staleTime: 0, refetchInterval: writing ? false : 5000, refetchOnWindowFocus: !writing });
}
export function updateManagerMenu(update: (data: ManagerMenuData) => ManagerMenuData) {
  queryClient.setQueryData<ManagerMenuData>(['/api/manager-menu'], data => data ? update(data) : data);
}
export async function refreshCafe(scope: 'menu' | 'profile' | 'library' = 'menu') {
  notifyContentChanged();
  await queryClient.invalidateQueries({ predicate: q => {
    const key = String(q.queryKey[0]);
    if (key === '/api/auth/user') return false;
    if (key.startsWith('/api/menu-library')) return scope === 'library' || key.endsWith('/targets');
    if (key === '/api/restaurant') return scope === 'profile';
    return key === '/api/manager-menu' || key.includes('/public') || key.startsWith('/api/super-admin/restaurants') || key.startsWith('/api/super-admin/menu-items') || key.startsWith('/api/super-admin/categories') || key.startsWith('/api/super-admin/price-variants') || key === '/api/cafes';
  } });
}
export async function uploadMedia(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB');
  const { uploadURL } = await (await apiRequest('POST', '/api/objects/upload')).json();
  const contentType = file.type || (file.name.toLowerCase().endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream');
  const response = await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });
  if (!response.ok) throw new Error('Upload failed. Use JPEG, PNG, GIF, WebP, MP4, or GLB.');
  return uploadURL.split('?')[0];
}
export function managerMoney(price: string | number, currency = 'QAR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(price));
}
