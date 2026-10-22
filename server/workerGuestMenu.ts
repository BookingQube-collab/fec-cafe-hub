import type { Client } from 'pg';

// Build the public snapshot in PostgreSQL. Avoid booting the management server
// and parsing/serializing every item on each five-second guest refresh: the
// free Worker has a 10 ms CPU budget. One statement also gives a consistent
// view of visibility, prices and options. No cross-request menu cache is used.
const guestSnapshot = `
WITH cafe AS (
  SELECT id, name, theme, currency, timezone, logo_url AS "logoUrl",
    cover_media_url AS "coverMediaUrl", cover_media_type AS "coverMediaType",
    cuisine_type AS "cuisineType", address, phone, opening_hours AS "openingHours"
  FROM restaurants WHERE id = $1 AND status = 'active' AND hidden = false
), cats AS (
  SELECT c.id, c.restaurant_id AS "restaurantId", c.title, c."order",
    to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
  FROM categories c JOIN cafe ON cafe.id = c.restaurant_id
), items AS (
  SELECT i.id, i.category_id AS "categoryId", i.name, i.description,
    i.price::text AS price, i.discount::text AS discount, i.unit,
    i.image_url AS "imageUrl", i.is_available AS "isAvailable",
    i.special_date AS "specialDate", i.has_multiple_pricing AS "hasMultiplePricing",
    i.modifier_groups AS "modifierGroups", i.tags, i."order",
    to_char(i.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
    to_char(i.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
  FROM menu_items i JOIN cats ON cats.id = i.category_id WHERE i.is_available = true
), variants AS (
  SELECT v.id, v.menu_item_id AS "menuItemId", v.label, v.price::text AS price,
    v.discount::text AS discount, v.unit, v."order",
    to_char(v.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
  FROM menu_item_price_variants v JOIN items ON items.id = v.menu_item_id
)
SELECT json_build_object(
  'restaurant', row_to_json(cafe),
  'categories', COALESCE((SELECT json_agg(cats ORDER BY "order", id) FROM cats), '[]'::json),
  'items', COALESCE((SELECT json_agg(items ORDER BY "order", id) FROM items), '[]'::json),
  'variants', COALESCE((SELECT json_agg(variants ORDER BY "order", "menuItemId", id) FROM variants), '[]'::json)
)::text AS body FROM cafe`;

export function guestMenuId(request: Request): string | undefined {
  if (!['GET', 'HEAD'].includes(request.method)) return;
  return new URL(request.url).pathname.match(/^\/api\/menu\/public\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i)?.[1];
}

export async function serveGuestMenu(request: Request, id: string, client: Client): Promise<Response> {
  const { rows } = await client.query<{ body: string }>(guestSnapshot, [id]);
  if (!rows.length) return Response.json({ message: 'Café unavailable' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(request.method === 'HEAD' ? null : rows[0].body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
