import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { tracks } from "@/db/schema/tracks";
import { alive } from "./getPlan";

/** Un plan tel que la liste de l'appareil le montre : son relevé et ses dates. */
export type PlanSummary = {
  accessId: string;
  name: string;
  distanceM: number;
  ascentM: number;
  lastSavedAt: Date;
  /** Nulle sur un plan modèle, qui ne périme pas. Voir `plans.expires_at`. */
  expiresAt: Date | null;
};

/**
 * Le relevé des plans que ce navigateur a retenus.
 *
 * Le navigateur ne garde que des identifiants : le nom, la distance et les
 * dates vivent en base. Un plan expiré ou supprimé ne ressort pas, et c'est
 * ainsi que l'écran le reconnaît pour l'oublier à son tour.
 *
 * La géométrie reste où elle est, comme dans `getPlan` : une liste de dix
 * plans qui rapporterait leurs traces pèserait quinze mégaoctets pour
 * afficher dix lignes de tableau.
 *
 * L'ordre est celui de la base et non celui de la demande. Le rangement
 * appartient à l'appareil, qui met en tête le dernier plan ouvert.
 */
export async function planSummaries(
  accessIds: string[],
): Promise<PlanSummary[]> {
  if (accessIds.length === 0) return [];

  return db
    .select({
      accessId: plans.accessId,
      name: tracks.name,
      distanceM: tracks.distanceM,
      ascentM: tracks.ascentM,
      lastSavedAt: plans.lastSavedAt,
      expiresAt: plans.expiresAt,
    })
    .from(plans)
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .where(and(inArray(plans.accessId, accessIds), alive));
}
