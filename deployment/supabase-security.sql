-- These tables are accessed only by the trusted server connection.
-- Anonymous and browser-authenticated Supabase clients get no direct access.
DO $$
DECLARE cafe_table text;
BEGIN
  FOREACH cafe_table IN ARRAY ARRAY['users','restaurants','categories','menu_items','menu_item_price_variants','global_menu_items','payments','access_audit','sessions','media_objects','rate_limit_buckets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', cafe_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', cafe_table);
  END LOOP;
END $$;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cafe-media', 'cafe-media', false, 5242880, ARRAY['image/png','image/jpeg','image/gif','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;
-- No browser Storage policies: media goes through our signed, ownership-checked API.
