// Printed restaurant QRs always use the published origin, including from local dashboards.
export const PUBLIC_MENU_ORIGIN = 'https://menu.cafe-menu.workers.dev';
export const MANAGEMENT_ORIGIN = 'https://staff.cafe-menu.workers.dev';
export function permanentMenuUrl(restaurantId: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(restaurantId)) throw new Error('A saved restaurant is required for its menu QR.');
  return `${PUBLIC_MENU_ORIGIN}/menu/${restaurantId}`;
}
