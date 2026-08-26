import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  numeric,
  primaryKey,
  snakeCase,
  time,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

export const planSettings = snakeCase.table(
  "plan_settings",
  {
    planId: uuid().notNull(),
    massKg: numeric({ precision: 4, scale: 1, mode: "number" }),
    targetTimeS: integer(),
    climbIntensity: numeric({ precision: 3, scale: 2, mode: "number" })
      .notNull()
      .default(0.25),
    paceSplit: numeric({ precision: 3, scale: 2, mode: "number" }).notNull(),
    raceDate: date(),
    startTime: time(),
    targetCarbsGH: integer("target_carbs_g_h").notNull().default(30),
    targetFluidMlH: integer().notNull().default(500),
    targetSodiumMgL: integer().notNull().default(500),
  },
  (table) => [
    primaryKey({
      name: "plan_settings_pk",
      columns: [table.planId],
    }),
    foreignKey({
      name: "plan_settings_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("cascade"),
    check("plan_settings_mass_kg_positive", sql`${table.massKg} > 0`),
    check("plan_settings_target_time_positive", sql`${table.targetTimeS} > 0`),
    check(
      "plan_settings_climb_intensity_between_0_and_1",
      sql`${table.climbIntensity} >= 0 AND ${table.climbIntensity} <= 1`,
    ),
    check(
      "plan_settings_pace_split_between_minus_1_and_1",
      sql`${table.paceSplit} >= -1 AND ${table.paceSplit} <= 1`,
    ),
  ],
);
