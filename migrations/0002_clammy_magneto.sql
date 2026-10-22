CREATE TABLE "access_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar NOT NULL,
	"actor_email" text NOT NULL,
	"actor_role" varchar NOT NULL,
	"cafe_id" varchar,
	"action" text NOT NULL,
	"status" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
