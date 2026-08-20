import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

export const tracks = snakeCase.table(
  "tracks",
  {
    planId: uuid().notNull(),
    name: text().notNull(),
    distanceM: integer().notNull(),
    ascentM: integer().notNull(),
    points: jsonb().notNull(),
    importedAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "tracks_pk",
      columns: [table.planId],
    }),
    foreignKey({
      name: "tracks_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }),
    check("tracks_distance_positive", sql`${table.distanceM} > 0`),
    check("tracks_ascent_positive_or_zero", sql`${table.ascentM} >= 0`),
  ],
);
