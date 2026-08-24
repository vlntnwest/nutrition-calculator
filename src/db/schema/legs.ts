import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aidStations } from "./aidStations";
import { plans } from "./plans";

export const legs = snakeCase.table(
  "legs",
  {
    planId: uuid().notNull(),
    rank: integer().notNull(),
    endPositionM: integer(),
    ascentM: integer().notNull(),
    descentM: integer().notNull(),
    durationS: integer().notNull(),
  },
  (table) => [
    primaryKey({
      name: "legs_pk",
      columns: [table.planId, table.rank],
    }),
    foreignKey({
      name: "legs_plan_id_fkey",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("cascade"),
    foreignKey({
      name: "legs_end_position_fkey",
      columns: [table.planId, table.endPositionM],
      foreignColumns: [aidStations.planId, aidStations.positionM],
    }),
    check("legs_rank_positive", sql`${table.rank} > 0`),
    check("legs_ascent_positive_or_zero", sql`${table.ascentM} >= 0`),
    check("legs_descent_positive_or_zero", sql`${table.descentM} >= 0`),
    check("legs_duration_positive", sql`${table.durationS} > 0`),
    uniqueIndex("legs_single_open_end")
      .on(table.planId)
      .where(sql`${table.endPositionM} is null`),
  ],
);
