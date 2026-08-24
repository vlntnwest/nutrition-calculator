CREATE TABLE "leg_overrides" (
	"plan_id" uuid,
	"end_position_m" integer,
	"duration_override_s" integer,
	"carbs_override_g_h" integer,
	"sodium_override_mg_l" integer,
	"fluid_override_ml_l" integer,
	CONSTRAINT "leg_overrides_pk" PRIMARY KEY("plan_id","end_position_m"),
	CONSTRAINT "leg_overrides_end_position_positive" CHECK ("end_position_m" > 0),
	CONSTRAINT "leg_overrides_duration_positive" CHECK ("duration_override_s" > 0),
	CONSTRAINT "leg_overrides_carbs_positive" CHECK ("carbs_override_g_h" > 0),
	CONSTRAINT "leg_overrides_sodium_positive" CHECK ("sodium_override_mg_l" > 0),
	CONSTRAINT "leg_overrides_fluid_positive" CHECK ("fluid_override_ml_l" > 0)
);
--> statement-breakpoint
ALTER TABLE "legs" RENAME COLUMN "end_aid_station_m" TO "end_position_m";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP CONSTRAINT "aid_stations_duration_positive";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP CONSTRAINT "aid_stations_carbs_positive";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP CONSTRAINT "aid_stations_sodium_positive";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP CONSTRAINT "aid_stations_fluid_positive";--> statement-breakpoint
ALTER TABLE "plan_settings" DROP CONSTRAINT "plan_settings_finish_duration_positive";--> statement-breakpoint
ALTER TABLE "legs" RENAME CONSTRAINT "legs_end_aid_station_fkey" TO "legs_end_position_fkey";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP COLUMN "duration_override_s";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP COLUMN "carbs_override_g_h";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP COLUMN "sodium_override_mg_l";--> statement-breakpoint
ALTER TABLE "aid_stations" DROP COLUMN "fluid_override_ml_l";--> statement-breakpoint
ALTER TABLE "plan_settings" DROP COLUMN "finish_duration_override_s";--> statement-breakpoint
DROP INDEX "legs_single_open_end";--> statement-breakpoint
CREATE UNIQUE INDEX "legs_single_open_end" ON "legs" ("plan_id") WHERE "end_position_m" is null;--> statement-breakpoint
ALTER TABLE "leg_overrides" ADD CONSTRAINT "leg_overrides_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;