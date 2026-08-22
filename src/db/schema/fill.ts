import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  uuid,
} from "drizzle-orm/pg-core";
import { flasks } from "./flasks";
import { legs } from "./legs";
import { productSnapshots } from "./productSnapshots";

export const fill = snakeCase.table(
  "fill",
  {
    planId: uuid().notNull(),
    legRank: integer().notNull(),
    flaskRank: integer().notNull(),
    productSnapshotId: uuid(),
    volumeMl: integer().notNull(),
    remainingMl: integer().notNull(),
  },
  (table) => [
    primaryKey({
      name: "fill_pk",
      columns: [table.planId, table.legRank, table.flaskRank],
    }),
    foreignKey({
      name: "fill_leg_fk",
      columns: [table.planId, table.legRank],
      foreignColumns: [legs.planId, legs.rank],
    }).onDelete("cascade"),
    foreignKey({
      name: "fill_flask_fk",
      columns: [table.flaskRank, table.planId],
      foreignColumns: [flasks.rank, flasks.planId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fill_product_snapshot_fk",
      columns: [table.productSnapshotId],
      foreignColumns: [productSnapshots.id],
    }).onDelete("restrict"),
    check("fill_volume_be_positive", sql`${table.volumeMl} > 0`),
    check("fill_remaining_be_positive_or_zero", sql`${table.remainingMl} >= 0`),
    check(
      "fill_remaining_lte_volume",
      sql`${table.remainingMl} <= ${table.volumeMl}`,
    ),
  ],
);
