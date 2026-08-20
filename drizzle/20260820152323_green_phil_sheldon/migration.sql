ALTER TABLE "plan_settings" ADD COLUMN "race_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "race_date";