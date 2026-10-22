import { apiRequest, queryClient } from './queryClient';
import { notifySessionChanged } from './sessionSync';
export async function logout() {
  await apiRequest('POST', '/api/logout');
  queryClient.clear(); notifySessionChanged(); window.location.href = '/login';
}
