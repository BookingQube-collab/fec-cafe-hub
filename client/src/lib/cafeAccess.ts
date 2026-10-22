import { apiRequest, queryClient } from './queryClient';
import { notifySessionChanged } from './sessionSync';

export async function openCafeWorkspace(restaurantId: string) {
  await apiRequest('POST', '/api/super-admin/cafe-access', { restaurantId });
  queryClient.clear(); notifySessionChanged();
  window.location.href = '/admin';
}
export async function returnToPlatform() {
  await apiRequest('DELETE', '/api/super-admin/cafe-access');
  queryClient.clear(); notifySessionChanged();
  window.location.href = '/super-admin';
}
