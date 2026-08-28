import {
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  snakeCase,
  uuid,
} from "drizzle-orm/pg-core";

import { legs } from "./legs";
import { plans } from "./plans";

export const warningEnum = pgEnum("warning", [
  "no-carb-product",
  "carbs-above-guide",
  "carbs-single-source",
  "carbs-above-target",
  "fluid-above-guide",
  "sodium-below-target",
  "leg-fluid-above-target",
  "leg-fluid-above-carry",
  "leg-drink-unused",
  "leg-drink-above-flasks",
]);

export const warnings = snakeCase.table(
  "warnings",
  {
    id: uuid().notNull().defaultRandom(),
    planId: uuid().notNull(),
    legRank: integer(),
    code: warningEnum().notNull(),
    payload: jsonb(),
  },
  (table) => [
    primaryKey({
      name: "warnings_pk",
      columns: [table.id],
    }),
    foreignKey({
      name: "warnings_leg_fk",
      columns: [table.legRank, table.planId],
      foreignColumns: [legs.rank, legs.planId],
    }).onDelete("cascade"),
    foreignKey({
      name: "warnings_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("cascade"),
  ],
);
