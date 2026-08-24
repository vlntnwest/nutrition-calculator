import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

/**
 * Ce qui est imposé au secteur qui se termine à cette abscisse.
 *
 * Un secteur n'a pas d'identité stable — `legs` est réécrit à chaque calcul —
 * mais sa borne de fin est de la saisie : la position d'un ravito, ou la
 * distance totale pour le secteur d'arrivée, que ne clôt aucun ravito. D'où
 * l'absence de clé étrangère vers `aid_stations` : `createPlan` vérifie.
 */
export const legOverrides = snakeCase.table(
  "leg_overrides",
  {
    planId: uuid().notNull(),
    endPositionM: integer().notNull(),
    durationOverrideS: integer(),
    carbsOverrideG_H: integer(),
    sodiumOverrideMg_L: integer(),
    fluidOverrideMl_L: integer(),
  },
  (table) => [
    primaryKey({
      name: "leg_overrides_pk",
      columns: [table.planId, table.endPositionM],
    }),
    foreignKey({
      name: "leg_overrides_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("cascade"),
    check(
      "leg_overrides_end_position_positive",
      sql`${table.endPositionM} > 0`,
    ),
    check(
      "leg_overrides_duration_positive",
      sql`${table.durationOverrideS} > 0`,
    ),
    check("leg_overrides_carbs_positive", sql`${table.carbsOverrideG_H} > 0`),
    check(
      "leg_overrides_sodium_positive",
      sql`${table.sodiumOverrideMg_L} > 0`,
    ),
    check("leg_overrides_fluid_positive", sql`${table.fluidOverrideMl_L} > 0`),
  ],
);
