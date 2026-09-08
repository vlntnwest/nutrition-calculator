ALTER TABLE "warnings" ALTER COLUMN "code" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "warning";--> statement-breakpoint
CREATE TYPE "warning" AS ENUM('no-carb-product', 'carbs-above-guide', 'carbs-single-source', 'carbs-above-target', 'fluid-above-guide', 'sodium-below-target', 'sodium-above-target', 'leg-fluid-above-target', 'leg-fluid-above-carry', 'leg-drink-above-flasks');--> statement-breakpoint
ALTER TABLE "warnings" ALTER COLUMN "code" SET DATA TYPE "warning" USING "code"::"warning";