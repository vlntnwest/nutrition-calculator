CREATE TYPE "warning" AS ENUM('no-carb-product', 'carbs-above-guide', 'carbs-single-source', 'fluid-above-guide', 'sodium-below-target', 'leg-fluid-above-target', 'leg-fluid-above-carry', 'leg-drink-unused', 'leg-drink-above-flasks');--> statement-breakpoint
CREATE TABLE "aid_stations" (
	"plan_id" uuid,
	"position_m" integer,
	"name" text NOT NULL,
	"provides_liquid" boolean DEFAULT true,
	"provides_solid" boolean DEFAULT true,
	"duration_override_s" integer,
	"carbs_override_g_h" integer,
	"sodium_override_mg_l" integer,
	"fluid_override_ml_l" integer,
	"stop_duration_s" integer,
	CONSTRAINT "aid_stations_pk" PRIMARY KEY("plan_id","position_m"),
	CONSTRAINT "aid_stations_duration_positive" CHECK ("duration_override_s" > 0),
	CONSTRAINT "aid_stations_carbs_positive" CHECK ("carbs_override_g_h" > 0),
	CONSTRAINT "aid_stations_sodium_positive" CHECK ("sodium_override_mg_l" > 0),
	CONSTRAINT "aid_stations_fluid_positive" CHECK ("fluid_override_ml_l" > 0),
	CONSTRAINT "aid_stations_stop_duration_positive" CHECK ("stop_duration_s" > 0),
	CONSTRAINT "aid_stations_name_not_empty" CHECK ("name" != '')
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"affiliate_url" text,
	"website_url" text,
	CONSTRAINT "brands_pk" PRIMARY KEY("id"),
	CONSTRAINT "brands_name_not_empty" CHECK ("name" != '')
);
--> statement-breakpoint
CREATE TABLE "fill" (
	"plan_id" uuid,
	"leg_rank" integer,
	"flask_rank" integer,
	"product_snapshot_id" uuid NOT NULL,
	"volume_ml" integer NOT NULL,
	"remaining_ml" integer NOT NULL,
	CONSTRAINT "fill_pk" PRIMARY KEY("plan_id","leg_rank","flask_rank"),
	CONSTRAINT "fill_volume_be_positive" CHECK ("volume_ml" > 0),
	CONSTRAINT "fill_remaining_be_positive_or_zero" CHECK ("remaining_ml" >= 0),
	CONSTRAINT "fill_remaining_lte_volume" CHECK ("remaining_ml" <= "volume_ml")
);
--> statement-breakpoint
CREATE TABLE "flasks" (
	"plan_id" uuid,
	"rank" integer,
	"volume_ml" integer NOT NULL,
	"only_water" boolean DEFAULT false NOT NULL,
	CONSTRAINT "flasks_pk" PRIMARY KEY("plan_id","rank"),
	CONSTRAINT "flasks_rank_positive" CHECK ("rank" > 0),
	CONSTRAINT "flasks_volume_ml_positive" CHECK ("volume_ml" > 0)
);
--> statement-breakpoint
CREATE TABLE "formats" (
	"id" uuid DEFAULT gen_random_uuid(),
	"label" text NOT NULL,
	CONSTRAINT "formats_pk" PRIMARY KEY("id"),
	CONSTRAINT "formats_label_not_empty" CHECK ("label" != '')
);
--> statement-breakpoint
CREATE TABLE "legs" (
	"plan_id" uuid,
	"rank" integer,
	"end_aid_station_m" integer NOT NULL,
	"ascent_m" integer NOT NULL,
	"descent_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	CONSTRAINT "legs_pk" PRIMARY KEY("plan_id","rank"),
	CONSTRAINT "legs_rank_positive" CHECK ("rank" > 0),
	CONSTRAINT "legs_ascent_positive_or_zero" CHECK ("ascent_m" >= 0),
	CONSTRAINT "legs_descent_positive_or_zero" CHECK ("descent_m" >= 0),
	CONSTRAINT "legs_duration_positive" CHECK ("duration_s" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_settings" (
	"plan_id" uuid,
	"mass_kg" numeric(4,1) NOT NULL,
	"target_time_s" integer NOT NULL,
	"ascent_override_m" integer,
	"climb_intensity" numeric(3,2) DEFAULT '0.25' NOT NULL,
	"pace_split" numeric(3,2) NOT NULL,
	"start_time" time,
	"target_carbs_g_h" integer DEFAULT 30 NOT NULL,
	"target_fluid_ml_h" integer DEFAULT 500 NOT NULL,
	"target_sodium_mg_l" integer DEFAULT 500 NOT NULL,
	CONSTRAINT "plan_settings_pk" PRIMARY KEY("plan_id"),
	CONSTRAINT "plan_settings_mass_kg_positive" CHECK ("mass_kg" > 0),
	CONSTRAINT "plan_settings_target_time_positive" CHECK ("target_time_s" > 0),
	CONSTRAINT "plan_settings_ascent_override_positive" CHECK ("ascent_override_m" >= 0),
	CONSTRAINT "plan_settings_climb_intensity_between_0_and_1" CHECK ("climb_intensity" >= 0 AND "climb_intensity" <= 1),
	CONSTRAINT "plan_settings_pace_split_between_minus_1_and_1" CHECK ("pace_split" >= -1 AND "pace_split" <= 1)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"access_id" uuid DEFAULT gen_random_uuid(),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"last_saved_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"generated_at" timestamp(6) with time zone,
	CONSTRAINT "plans_pk" PRIMARY KEY("access_id")
);
--> statement-breakpoint
CREATE TABLE "product_snapshots" (
	"id" uuid DEFAULT gen_random_uuid(),
	"plan_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand_name" text,
	"format_label" text NOT NULL,
	"energy_kcal" integer NOT NULL,
	"carbs_g" numeric(3,1) NOT NULL,
	"protein_g" numeric(3,1),
	"fat_g" numeric(3,1),
	"fiber_g" numeric(3,1),
	"sugar_g" numeric(3,1),
	"sodium_mg" integer NOT NULL,
	"caffeine_mg" integer NOT NULL,
	"fluid_ml" integer,
	"weight_g" integer NOT NULL,
	"divisible_by" integer DEFAULT 1 NOT NULL,
	"multi_transportable" boolean DEFAULT false NOT NULL,
	"frozen_at" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "product_snapshots_pk" PRIMARY KEY("id"),
	CONSTRAINT "product_snapshots_fluid_ml_positive" CHECK ("fluid_ml" >= 0),
	CONSTRAINT "product_snapshots_weight_g_positive" CHECK ("weight_g" >= 0),
	CONSTRAINT "product_snapshots_energy_kcal_positive" CHECK ("energy_kcal" >= 0),
	CONSTRAINT "product_snapshots_carbs_g_positive" CHECK ("carbs_g" >= 0),
	CONSTRAINT "product_snapshots_protein_g_positive" CHECK ("protein_g" >= 0),
	CONSTRAINT "product_snapshots_fat_g_positive" CHECK ("fat_g" >= 0),
	CONSTRAINT "product_snapshots_fiber_g_positive" CHECK ("fiber_g" >= 0),
	CONSTRAINT "product_snapshots_sugar_g_positive" CHECK ("sugar_g" >= 0),
	CONSTRAINT "sugar_g_lte_carbs_g" CHECK ("sugar_g" <= "carbs_g"),
	CONSTRAINT "product_snapshots_sodium_mg_positive" CHECK ("sodium_mg" >= 0),
	CONSTRAINT "product_snapshots_caffeine_mg_positive" CHECK ("caffeine_mg" >= 0),
	CONSTRAINT "product_snapshots_divisible_by_one_or_two" CHECK ("divisible_by" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid DEFAULT gen_random_uuid(),
	"brand_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gtin" text UNIQUE,
	"energy_kcal" integer NOT NULL,
	"weight_g" integer NOT NULL,
	"carbs_g" numeric(3,1) NOT NULL,
	"sodium_mg" integer NOT NULL,
	"caffeine_mg" integer NOT NULL,
	"fluid_ml" integer NOT NULL,
	"protein_g" numeric(3,1),
	"fat_g" numeric(3,1),
	"fiber_g" numeric(3,1),
	"sugar_g" numeric(3,1),
	"divisible_by" integer DEFAULT 1 NOT NULL,
	"multi_transportable" boolean NOT NULL,
	"purchase_url" text,
	"discontinued_at" timestamp(6) with time zone,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_pk" PRIMARY KEY("id"),
	CONSTRAINT "products_carbs_positive" CHECK ("carbs_g" > 0),
	CONSTRAINT "products_energy_carbs_ratio" CHECK ("carbs_g" * 4 <= "energy_kcal" * 1.10),
	CONSTRAINT "products_divisible_by_one_or_two" CHECK ("divisible_by" IN (1, 2)),
	CONSTRAINT "product_fluid_ml_positive" CHECK ("fluid_ml" >= 0),
	CONSTRAINT "product_weight_g_positive" CHECK ("weight_g" >= 0),
	CONSTRAINT "product_energy_kcal_positive" CHECK ("energy_kcal" >= 0),
	CONSTRAINT "product_protein_g_positive" CHECK ("protein_g" >= 0),
	CONSTRAINT "product_fat_g_positive" CHECK ("fat_g" >= 0),
	CONSTRAINT "product_fiber_g_positive" CHECK ("fiber_g" >= 0),
	CONSTRAINT "product_sugar_g_positive" CHECK ("sugar_g" >= 0),
	CONSTRAINT "sugar_g_lte_carbs_g" CHECK ("sugar_g" <= "carbs_g"),
	CONSTRAINT "product_sodium_mg_positive" CHECK ("sodium_mg" >= 0),
	CONSTRAINT "product_caffeine_mg_positive" CHECK ("caffeine_mg" >= 0),
	CONSTRAINT "products_name_not_empty" CHECK ("name" != ''),
	CONSTRAINT "products_gtin_format" CHECK ("gtin" ~ '^[0-9]{8,14}$')
);
--> statement-breakpoint
CREATE TABLE "servings" (
	"plan_id" uuid,
	"leg_rank" integer,
	"product_snapshot_id" uuid,
	"quantity" numeric(3,1) NOT NULL,
	CONSTRAINT "servings_pk" PRIMARY KEY("plan_id","leg_rank","product_snapshot_id"),
	CONSTRAINT "servings_quantity_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"plan_id" uuid,
	"name" text NOT NULL,
	"race_date" date NOT NULL,
	"distance_m" integer NOT NULL,
	"ascent_m" integer NOT NULL,
	"points" jsonb NOT NULL,
	"imported_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_pk" PRIMARY KEY("plan_id"),
	CONSTRAINT "tracks_distance_positive" CHECK ("distance_m" > 0),
	CONSTRAINT "tracks_ascent_positive_or_zero" CHECK ("ascent_m" >= 0)
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" uuid DEFAULT gen_random_uuid(),
	"plan_id" uuid NOT NULL,
	"leg_rank" integer,
	"code" "warning" NOT NULL,
	"payload" jsonb,
	CONSTRAINT "warnings_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
ALTER TABLE "aid_stations" ADD CONSTRAINT "aid_stations_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "fill" ADD CONSTRAINT "fill_leg_fk" FOREIGN KEY ("plan_id","leg_rank") REFERENCES "legs"("plan_id","rank");--> statement-breakpoint
ALTER TABLE "fill" ADD CONSTRAINT "fill_flask_fk" FOREIGN KEY ("flask_rank","plan_id") REFERENCES "flasks"("rank","plan_id");--> statement-breakpoint
ALTER TABLE "fill" ADD CONSTRAINT "fill_product_snapshot_fk" FOREIGN KEY ("product_snapshot_id") REFERENCES "product_snapshots"("id");--> statement-breakpoint
ALTER TABLE "flasks" ADD CONSTRAINT "flasks_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "legs" ADD CONSTRAINT "legs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "legs" ADD CONSTRAINT "legs_end_aid_station_fkey" FOREIGN KEY ("plan_id","end_aid_station_m") REFERENCES "aid_stations"("plan_id","position_m");--> statement-breakpoint
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "product_snapshots" ADD CONSTRAINT "product_snapshots_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "product_snapshots" ADD CONSTRAINT "product_snapshots_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_format_fk" FOREIGN KEY ("format_id") REFERENCES "formats"("id");--> statement-breakpoint
ALTER TABLE "servings" ADD CONSTRAINT "servings_leg_fk" FOREIGN KEY ("plan_id","leg_rank") REFERENCES "legs"("plan_id","rank");--> statement-breakpoint
ALTER TABLE "servings" ADD CONSTRAINT "servings_product_snapshot_fk" FOREIGN KEY ("product_snapshot_id") REFERENCES "product_snapshots"("id");--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_leg_fk" FOREIGN KEY ("leg_rank","plan_id") REFERENCES "legs"("rank","plan_id");--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id");