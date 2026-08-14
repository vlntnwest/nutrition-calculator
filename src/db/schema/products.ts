import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const products = snakeCase.table(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    barcode: text().unique(),
    name: text().notNull(),
    brand: text().notNull(),
    type: text().notNull(),
    weightG: integer().notNull(),
    energyKcal: integer().notNull(),
    sodiumMg: integer().notNull(),
    fluidMl: integer().notNull(),
    carbsG: numeric({ precision: 4, scale: 1 }).notNull(),
    divisibleBy: integer().default(1).notNull(),
    multiTransportable: boolean().notNull(),
    discontinuedAt: timestamp({
      precision: 6,
      withTimezone: true,
    }),
  },
  (table) => [
    check("products_carbs_positive", sql`${table.carbsG} > 0`),
    check(
      "products_energy_carbs_ratio",
      sql`${table.carbsG} * 4 <= ${table.energyKcal} * 1.10`,
    ),
    check("products_divisible_by_positive", sql`${table.divisibleBy} >= 1`),
  ],
);
