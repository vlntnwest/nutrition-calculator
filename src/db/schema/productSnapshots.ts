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
import { plans } from "./plans";
import { products } from "./products";

export const productSnapshots = snakeCase.table(
  "product_snapshots",
  {
    id: uuid().defaultRandom(),
    planId: uuid().notNull(),
    productId: uuid().notNull(),
    name: text().notNull(),
    brandName: text(),
    formatLabel: text().notNull(),
    energyKcal: integer().notNull(),
    carbsG: numeric({ precision: 3, scale: 1 }).notNull(),
    proteinG: numeric({ precision: 3, scale: 1 }),
    fatG: numeric({ precision: 3, scale: 1 }),
    fiberG: numeric({ precision: 3, scale: 1 }),
    sugarG: numeric({ precision: 3, scale: 1 }),
    sodiumMg: integer().notNull(),
    caffeineMg: integer().notNull(),
    fluidMl: integer(),
    weightG: integer().notNull(),
    divisibleBy: integer().notNull().default(1),
    multiTransportable: boolean().notNull().default(false),
    frozenAt: timestamp({
      precision: 6,
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "product_snapshots_pk",
      columns: [table.id],
    }),

    foreignKey({
      name: "product_snapshots_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }),
    foreignKey({
      name: "product_snapshots_product_fk",
      columns: [table.productId],
      foreignColumns: [products.id],
    }),
    check("product_snapshots_fluid_ml_positive", sql`${table.fluidMl} >= 0`),
    check("product_snapshots_weight_g_positive", sql`${table.weightG} >= 0`),
    check(
      "product_snapshots_energy_kcal_positive",
      sql`${table.energyKcal} >= 0`,
    ),
    check("product_snapshots_carbs_g_positive", sql`${table.carbsG} >= 0`),
    check("product_snapshots_protein_g_positive", sql`${table.proteinG} >= 0`),
    check("product_snapshots_fat_g_positive", sql`${table.fatG} >= 0`),
    check("product_snapshots_fiber_g_positive", sql`${table.fiberG} >= 0`),
    check("product_snapshots_sugar_g_positive", sql`${table.sugarG} >= 0`),
    check("sugar_g_lte_carbs_g", sql`${table.sugarG} <= ${table.carbsG}`),
    check("product_snapshots_sodium_mg_positive", sql`${table.sodiumMg} >= 0`),
    check(
      "product_snapshots_caffeine_mg_positive",
      sql`${table.caffeineMg} >= 0`,
    ),
    check(
      "product_snapshots_divisible_by_one_or_two",
      sql`${table.divisibleBy} IN (1, 2)`,
    ),
  ],
);
