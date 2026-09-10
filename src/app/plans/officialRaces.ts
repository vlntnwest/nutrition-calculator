import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { officialRaces } from "@/db/schema/officialRaces";
import { tracks } from "@/db/schema/tracks";

/** Une course officielle telle que l'accueil l'affiche. */
export type OfficialRace = {
  slug: string;
  name: string;
  distanceM: number;
  ascentM: number;
  aidStationCount: number;
  photoPath: string;
  profilePath: string;
};

/**
 * Le catalogue des courses officielles, dans l'ordre des cartes.
 *
 * Le relevé se lit du plan modèle — distance, dénivelé, nombre de ravitos —
 * pour qu'une correction apportée au modèle se voie sur la carte sans
 * republication. Le tracé de la vignette, lui, est figé à la publication :
 * le profil pleine résolution pèse trop pour être relu à chaque accueil.
 */
export async function listOfficialRaces(): Promise<OfficialRace[]> {
  const rows = await db
    .select({
      slug: officialRaces.slug,
      planId: officialRaces.planId,
      photoPath: officialRaces.photoPath,
      profilePath: officialRaces.profilePath,
      name: tracks.name,
      distanceM: tracks.distanceM,
      ascentM: tracks.ascentM,
    })
    .from(officialRaces)
    .innerJoin(tracks, eq(tracks.planId, officialRaces.planId))
    .orderBy(officialRaces.rank, officialRaces.slug);

  if (rows.length === 0) return [];

  const counts = await db
    .select({ planId: aidStations.planId, total: count() })
    .from(aidStations)
    .where(
      inArray(
        aidStations.planId,
        rows.map((row) => row.planId),
      ),
    )
    .groupBy(aidStations.planId);

  const parPlan = new Map(counts.map((row) => [row.planId, row.total]));

  return rows.map(({ planId, ...race }) => ({
    ...race,
    aidStationCount: parPlan.get(planId) ?? 0,
  }));
}

/**
 * Le plan modèle derrière un lien public.
 *
 * L'identifiant d'accès du modèle est son droit de modification : il reste
 * au serveur, et l'accueil ne connaît que le `slug`.
 */
export async function officialRacePlanId(
  slug: string,
): Promise<string | undefined> {
  const [race] = await db
    .select({ planId: officialRaces.planId })
    .from(officialRaces)
    .where(eq(officialRaces.slug, slug));

  return race?.planId;
}
