ALTER TABLE "brands" ADD CONSTRAINT "brands_name_key" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "formats" ADD CONSTRAINT "formats_label_key" UNIQUE("label");