ALTER TABLE "access_audit" ADD COLUMN "cafe_name" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "request_key" varchar;--> statement-breakpoint
CREATE INDEX "access_audit_recent" ON "access_audit" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_cafe_name_unique" ON "categories" USING btree ("restaurant_id",lower(btrim("title")));--> statement-breakpoint
CREATE UNIQUE INDEX "option_item_label_unique" ON "menu_item_price_variants" USING btree ("menu_item_id",lower(btrim("label")));--> statement-breakpoint
CREATE UNIQUE INDEX "restaurants_one_owner" ON "restaurants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_case_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_key_unique" UNIQUE("request_key");--> statement-breakpoint
ALTER TABLE "menu_item_price_variants" ADD CONSTRAINT "option_price_valid" CHECK ("menu_item_price_variants"."price" >= 0);--> statement-breakpoint
ALTER TABLE "menu_item_price_variants" ADD CONSTRAINT "option_discount_valid" CHECK ("menu_item_price_variants"."discount" between 0 and 100);--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_price_valid" CHECK ("menu_items"."price" >= 0);--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_discount_valid" CHECK ("menu_items"."discount" between 0 and 100);--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_status" CHECK ("restaurants"."status" in ('active','suspended','pending'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_management_role" CHECK ("users"."role" in ('admin','super_admin'));