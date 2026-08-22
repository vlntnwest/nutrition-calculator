import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  numeric,
  primaryKey,
  snakeCase,
  uuid,
} from "drizzle-orm/pg-core";
import { legs } from "./legs";
import { productSnapshots } from "./productSnapshots";

export const servings = snakeCase.table(
  "servings",
  {
    planId: uuid().notNull(),
    legRank: integer().notNull(),
    productSnapshotId: uuid().notNull(),
    quantity: numeric({ precision: 3, scale: 1, mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "servings_pk",
      columns: [table.planId, table.legRank, table.productSnapshotId],
    }),
    foreignKey({
      name: "servings_leg_fk",
      columns: [table.planId, table.legRank],
      foreignColumns: [legs.planId, legs.rank],
    }).onDelete("cascade"),
    foreignKey({
      name: "servings_product_snapshot_fk",
      columns: [table.productSnapshotId],
      foreignColumns: [productSnapshots.id],
    }).onDelete("restrict"),
    check("servings_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
