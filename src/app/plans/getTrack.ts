import { eq } from "drizzle-orm";
import type { ProfilePoint, ResolvedPoint } from "@/core/type";
import { db } from "@/db";
import { tracks } from "@/db/schema/tracks";

/**
 * La géométrie d'une trace, lue à part du plan.
 *
 * Deux à quinze mille points, deux cents kilo-octets à un mégaoctet et demi
 * de `jsonb` : ce n'est pas ce qu'on relit pour afficher un formulaire. Les
 * deux colonnes se lisent donc séparément, et seuls les écrans Course et
 * Roadbook les demandent — le premier les deux, le second les points seuls.
 *
 * Aucune vérification d'expiration ici : la disposition a déjà rendu le 404
 * si le plan n'existe plus, et une trace sans plan n'existe pas non plus.
 */
export async function getTrackPoints(
  accessId: string,
): Promise<ResolvedPoint[]> {
  const [row] = await db
    .select({ points: tracks.points })
    .from(tracks)
    .where(eq(tracks.planId, accessId));

  return row?.points ?? [];
}

/**
 * Le profil pleine résolution — un point tous les dix mètres.
 *
 * Il ne sert qu'à l'écran Course, où les curseurs d'allure le relisent à
 * chaque geste : c'est la seule raison pour laquelle il traverse le réseau.
 */
export async function getTrackProfile(
  accessId: string,
): Promise<ProfilePoint[]> {
  const [row] = await db
    .select({ profile: tracks.profile })
    .from(tracks)
    .where(eq(tracks.planId, accessId));

  return row?.profile ?? [];
}
