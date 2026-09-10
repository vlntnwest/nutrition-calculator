import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { plans } from "./plans";

/**
 * Les courses proposées à l'accueil, chacune adossée à un plan modèle.
 *
 * Le modèle est un plan comme un autre — il se fabrique avec les écrans, sa
 * trace et ses ravitos vivent dans `tracks` et `aid_stations`. Cette table ne
 * porte que l'affiche : le lien public, la photo, la vignette de profil et le
 * rang. L'identifiant d'accès du modèle, lui, ne sort jamais : le visiteur
 * clique un `slug`, le serveur seul sait quel plan copier.
 */
export const officialRaces = snakeCase.table(
  "official_races",
  {
    slug: text().notNull(),
    planId: uuid().notNull(),
    photoPath: text().notNull(),
    /** Le `d` du tracé de la carte, calculé à la publication. */
    profilePath: text().notNull(),
    rank: integer().notNull().default(0),
    publishedAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "official_races_pk",
      columns: [table.slug],
    }),
    unique("official_races_plan_unique").on(table.planId),
    // `restrict` et non `cascade` : un modèle ne se supprime pas par mégarde
    // pendant qu'une carte pointe dessus. On dépublie d'abord.
    foreignKey({
      name: "official_races_plan_fk",
      columns: [table.planId],
      foreignColumns: [plans.accessId],
    }).onDelete("restrict"),
    check("official_races_slug_shape", sql`${table.slug} ~ '^[a-z0-9-]+$'`),
    check("official_races_photo_not_empty", sql`${table.photoPath} != ''`),
    check("official_races_profile_not_empty", sql`${table.profilePath} != ''`),
  ],
);
