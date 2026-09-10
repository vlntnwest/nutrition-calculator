import { sql } from "drizzle-orm";
import { primaryKey, snakeCase, timestamp, uuid } from "drizzle-orm/pg-core";

export const plans = snakeCase.table(
  "plans",
  {
    accessId: uuid().defaultRandom().notNull(),
    createdAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastSavedAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    generatedAt: timestamp({
      precision: 6,
      withTimezone: true,
    }),
    /**
     * Quand le plan calculé a été retouché à la main. Nulle sur un plan qui
     * sort du calcul : une génération l'efface. ADR 011.
     */
    editedAt: timestamp({
      precision: 6,
      withTimezone: true,
    }),
    /**
     * Quand le plan s'efface de lui-même. Nulle sur un plan modèle : une
     * course officielle ne périme pas. Cf. `official_races`.
     */
    expiresAt: timestamp({ precision: 6, withTimezone: true }).default(
      sql`now() + interval '6 months'`,
    ),
  },
  (table) => [
    primaryKey({
      name: "plans_pk",
      columns: [table.accessId],
    }),
  ],
);
