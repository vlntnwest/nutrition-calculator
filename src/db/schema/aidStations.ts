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
    providesSolid: boolean().notNull().default(true),
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
    // Zéro est une consigne, pas une absence de consigne : « je passe sans
    // m'arrêter ». L'écran l'accepte, et `toRow` arrondit à la minute — un
    // arrêt de vingt secondes s'affiche « 0 » et se réenregistre à zéro.
    check(
      "aid_stations_stop_duration_positive_or_zero",
      sql`${table.stopDurationS} >= 0`,
    ),
    check("aid_stations_name_not_empty", sql`${table.name} != ''`),
  ],
);
