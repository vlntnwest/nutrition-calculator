CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"barcode" text UNIQUE,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"type" text NOT NULL,
	"weight_g" integer NOT NULL,
	"energy_kcal" integer NOT NULL,
	"sodium_mg" integer NOT NULL,
	"fluid_ml" integer NOT NULL,
	"carbs_g" numeric(4,1) NOT NULL,
	"divisible_by" integer DEFAULT 1 NOT NULL,
	"multi_transportable" boolean NOT NULL,
	"discontinued_at" timestamp(6) with time zone,
	CONSTRAINT "products_carbs_positive" CHECK ("carbs_g" > 0),
	CONSTRAINT "products_energy_carbs_ratio" CHECK ("carbs_g" * 4 <= "energy_kcal" * 1.05),
	CONSTRAINT "products_divisible_by_positive" CHECK ("divisible_by" >= 1)
);
