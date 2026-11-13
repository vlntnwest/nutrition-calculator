ALTER TABLE "products" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "own_brand" text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "brand_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "products_plan_idx" ON "products" ("plan_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("access_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_or_plan" CHECK (("plan_id" IS NULL AND "brand_id" IS NOT NULL AND "own_brand" IS NULL) OR ("plan_id" IS NOT NULL AND "brand_id" IS NULL));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_own_brand_not_empty" CHECK ("own_brand" != '');