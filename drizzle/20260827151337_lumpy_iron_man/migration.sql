ALTER TABLE "plan_settings" ALTER COLUMN "target_carbs_g_h" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "plan_settings" ALTER COLUMN "target_carbs_g_h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_settings" ALTER COLUMN "target_fluid_ml_h" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "plan_settings" ALTER COLUMN "target_fluid_ml_h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_settings" ALTER COLUMN "target_sodium_mg_l" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "plan_settings" ALTER COLUMN "target_sodium_mg_l" DROP NOT NULL;