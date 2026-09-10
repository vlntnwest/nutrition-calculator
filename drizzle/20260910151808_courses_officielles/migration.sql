CREATE TABLE "official_races" (
	"slug" text,
	"plan_id" uuid NOT NULL CONSTRAINT "official_races_plan_unique" UNIQUE,
	"photo_path" text NOT NULL,
	"profile_path" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_races_pk" PRIMARY KEY("slug"),
	CONSTRAINT "official_races_slug_shape" CHECK ("slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "official_races_photo_not_empty" CHECK ("photo_path" != ''),
	CONSTRAINT "official_races_profile_not_empty" CHECK ("profile_path" != '')
);
--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "official_races" ADD CONSTRAINT "official_races_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE RESTRICT;