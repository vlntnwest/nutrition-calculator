ALTER TABLE "plans" ADD COLUMN "expires_at" timestamp(6) with time zone DEFAULT now() + interval '6 months' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "code_seed" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fill" ALTER COLUMN "product_snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legs" ALTER COLUMN "end_aid_station_m" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_code_seed_key" UNIQUE("code_seed");--> statement-breakpoint
CREATE UNIQUE INDEX "legs_single_open_end" ON "legs" ("plan_id") WHERE "end_aid_station_m" is null;--> statement-breakpoint
ALTER TABLE "aid_stations" DROP CONSTRAINT "aid_stations_plan_fk", ADD CONSTRAINT "aid_stations_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fill" DROP CONSTRAINT "fill_leg_fk", ADD CONSTRAINT "fill_leg_fk" FOREIGN KEY ("plan_id","leg_rank") REFERENCES "legs"("plan_id","rank") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fill" DROP CONSTRAINT "fill_flask_fk", ADD CONSTRAINT "fill_flask_fk" FOREIGN KEY ("flask_rank","plan_id") REFERENCES "flasks"("rank","plan_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fill" DROP CONSTRAINT "fill_product_snapshot_fk", ADD CONSTRAINT "fill_product_snapshot_fk" FOREIGN KEY ("product_snapshot_id") REFERENCES "product_snapshots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "flasks" DROP CONSTRAINT "flasks_plan_fk", ADD CONSTRAINT "flasks_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "legs" DROP CONSTRAINT "legs_plan_id_fkey", ADD CONSTRAINT "legs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "plan_settings" DROP CONSTRAINT "plan_settings_plan_fk", ADD CONSTRAINT "plan_settings_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_snapshots" DROP CONSTRAINT "product_snapshots_plan_fk", ADD CONSTRAINT "product_snapshots_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "servings" DROP CONSTRAINT "servings_leg_fk", ADD CONSTRAINT "servings_leg_fk" FOREIGN KEY ("plan_id","leg_rank") REFERENCES "legs"("plan_id","rank") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "servings" DROP CONSTRAINT "servings_product_snapshot_fk", ADD CONSTRAINT "servings_product_snapshot_fk" FOREIGN KEY ("product_snapshot_id") REFERENCES "product_snapshots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_plan_fk", ADD CONSTRAINT "tracks_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warnings" DROP CONSTRAINT "warnings_leg_fk", ADD CONSTRAINT "warnings_leg_fk" FOREIGN KEY ("leg_rank","plan_id") REFERENCES "legs"("rank","plan_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warnings" DROP CONSTRAINT "warnings_plan_fk", ADD CONSTRAINT "warnings_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_code_seed_format" CHECK ("code_seed" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');