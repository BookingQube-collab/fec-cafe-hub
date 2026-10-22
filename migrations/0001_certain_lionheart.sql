CREATE TABLE "global_menu_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_item_id" varchar,
	"publisher_id" varchar,
	"source_cafe" text NOT NULL,
	"currency" varchar NOT NULL,
	"category_title" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"image_url" text,
	"source_image_url" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "global_menu_items_source_item_id_unique" UNIQUE("source_item_id")
);
--> statement-breakpoint
ALTER TABLE "global_menu_items" ADD CONSTRAINT "global_menu_items_source_item_id_menu_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_menu_items" ADD CONSTRAINT "global_menu_items_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;