import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

export const aidStations = snakeCase.table(
  "aid_stations",
  {
    planId: uuid().notNull(),
    positionM: integer().notNull(),
    name: text().notNull(),
    providesLiquid: boolean().notNull().default(true),
    providesSolid: boolean().default(true),
    stopDurationS: integer(),
  },
  (table) => [
    primaryKey({
      name: "aid_stations_pk",
      columns: [table.planId, table.positionM],
    }),
    foreignKey({
      name: "aid_stations_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("cascade"),
    check(
      "aid_stations_stop_duration_positive",
      sql`${table.stopDurationS} > 0`,
    ),
    check("aid_stations_name_not_empty", sql`${table.name} != ''`),
  ],
);
