import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  numeric,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "./brands";
import { formats } from "./formats";

export const products = snakeCase.table(
  "products",
  {
    id: uuid().defaultRandom().notNull(),
    /**
     * L'identifiant du fichier de seed — « naak-waffle-citron ». C'est la clé
     * naturelle sur laquelle le seed s'upserte : sans elle, le relancer
     * duplique le catalogue, `gtin` étant optionnel.
     *
     * Convention : `marque-format-distinctif`, le format reprenant le
     * vocabulaire de `ProductType` du noyau. Choisi à la main, jamais dérivé
     * du nom commercial — une clé qui suit le packaging n'est pas une clé.
     */
    codeSeed: text().notNull().unique(),
    brandId: uuid().notNull(),
    formatId: uuid().notNull(),
    name: text().notNull(),
    gtin: text().unique(),
    energyKcal: integer().notNull(),
    weightG: integer().notNull(),
    carbsG: numeric({ precision: 3, scale: 1, mode: "number" }).notNull(),
    sodiumMg: integer().notNull(),
    caffeineMg: integer().notNull(),
    fluidMl: integer().notNull(),
    proteinG: numeric({ precision: 3, scale: 1, mode: "number" }),
    fatG: numeric({ precision: 3, scale: 1, mode: "number" }),
    fiberG: numeric({ precision: 3, scale: 1, mode: "number" }),
    sugarG: numeric({ precision: 3, scale: 1, mode: "number" }),
    divisibleBy: integer().default(1).notNull(),
    multiTransportable: boolean().notNull(),
    purchaseUrl: text(),
    discontinuedAt: timestamp({
      precision: 6,
      withTimezone: true,
    }),
    updatedAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "products_pk",
      columns: [table.id],
    }),
    foreignKey({
      name: "products_brand_fk",
      columns: [table.brandId],
      foreignColumns: [brands.id],
    }),
    foreignKey({
      name: "products_format_fk",
      columns: [table.formatId],
      foreignColumns: [formats.id],
    }),
    check("products_carbs_positive", sql`${table.carbsG} > 0`),
    check(
      "products_energy_carbs_ratio",
      sql`${table.carbsG} * 4 <= ${table.energyKcal} * 1.10`,
    ),
    check(
      "products_divisible_by_one_or_two",
      sql`${table.divisibleBy} IN (1, 2)`,
    ),
    check("product_fluid_ml_positive", sql`${table.fluidMl} >= 0`),
    check("product_weight_g_positive", sql`${table.weightG} >= 0`),
    check("product_energy_kcal_positive", sql`${table.energyKcal} >= 0`),
    check("product_protein_g_positive", sql`${table.proteinG} >= 0`),
    check("product_fat_g_positive", sql`${table.fatG} >= 0`),
    check("product_fiber_g_positive", sql`${table.fiberG} >= 0`),
    check("product_sugar_g_positive", sql`${table.sugarG} >= 0`),
    check("sugar_g_lte_carbs_g", sql`${table.sugarG} <= ${table.carbsG}`),
    check("product_sodium_mg_positive", sql`${table.sodiumMg} >= 0`),
    check("product_caffeine_mg_positive", sql`${table.caffeineMg} >= 0`),
    check("products_name_not_empty", sql`${table.name} != ''`),
    check("products_gtin_format", sql`${table.gtin} ~ '^[0-9]{8,14}$'`),
    check(
      "products_code_seed_format",
      sql`${table.codeSeed} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);
