import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

export const flasks = snakeCase.table(
  "flasks",
  {
    planId: uuid().notNull(),
    rank: integer().notNull(),
    volumeMl: integer().notNull(),
    onlyWater: boolean().notNull().default(false),
  },
  (table) => [
    primaryKey({
      name: "flasks_pk",
      columns: [table.planId, table.rank],
    }),
    foreignKey({
      name: "flasks_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }),
    check("flasks_rank_positive", sql`${table.rank} > 0`),
    check("flasks_volume_ml_positive", sql`${table.volumeMl} > 0`),
  ],
);
