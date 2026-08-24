ALTER TABLE "fill" DROP CONSTRAINT "fill_remaining_be_positive_or_zero";--> statement-breakpoint
ALTER TABLE "fill" DROP CONSTRAINT "fill_remaining_lte_volume";--> statement-breakpoint
ALTER TABLE "fill" DROP COLUMN "remaining_ml";