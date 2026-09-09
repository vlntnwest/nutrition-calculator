ALTER TABLE "plan_settings" DROP CONSTRAINT "plan_settings_climb_intensity_between_0_and_1";--> statement-breakpoint
ALTER TABLE "plan_settings" ADD COLUMN "climb_effort" numeric(3,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_settings" DROP COLUMN "climb_intensity";--> statement-breakpoint
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_climb_effort_between_minus_1_and_1" CHECK ("climb_effort" >= -1 AND "climb_effort" <= 1);