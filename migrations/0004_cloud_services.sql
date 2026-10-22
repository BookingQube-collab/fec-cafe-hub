CREATE TABLE "media_objects" (
  "id" varchar PRIMARY KEY NOT NULL,
  "owner_id" varchar NOT NULL CONSTRAINT "media_objects_owner_id_users_id_fk" REFERENCES "users"("id") ON DELETE CASCADE,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
  "id" varchar PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "reset_at" timestamptz NOT NULL
);--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry" ON "rate_limit_buckets" ("reset_at");
