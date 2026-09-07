import { distributeTime, timeSegments } from "@/core/distribute";
import { splitBySlope } from "@/core/split";
import type { PacingProfile, ProfilePoint, Segment } from "@/core/type";
import type { PaceBand } from "@/ui/track/ElevationChart";

/**
 * Les tronçons sur lesquels l'allure se lit : ceux du pipeline, aux réglages
 * par défaut de `splitBySlope`.
 *
 * Ne dépend que du relief : les curseurs d'allure ne le refont pas.
 */
export function paceSegments(profile: ProfilePoint[]): Segment[] {
  return splitBySlope(profile);
}

/**
 * L'allure de chaque tronçon pour un chrono visé, telle qu'elle se trace sur
 * le profil.
 *
 * Même composition que la régénération : le temps se répartit sur toute la
 * trace en pleine résolution, puis se relit tronçon par tronçon. Seule la
 * finesse du découpage est celle de l'écran, jamais celle du calcul. Rien
 * n'est enregistré, c'est le chrono en cours de saisie qui parle.
 *
 * @param movingS Le temps de **mouvement**, arrêts déduits. ADR 010.
 */
export function paceBand(
  profile: ProfilePoint[],
  segments: Segment[],
  movingS: number | undefined,
  pacing: PacingProfile,
): PaceBand | null {
  if (movingS === undefined || movingS <= 0) return null;
  if (profile.length < 2 || segments.length === 0) return null;

  const totalM = profile[profile.length - 1].d - profile[0].d;
  if (totalM <= 0) return null;

  const timed = timeSegments(
    distributeTime(profile, movingS, pacing),
    segments,
  );
  // Un tronçon de longueur ou de durée nulle n'a pas d'allure : la tracer
  // demanderait une division par zéro, et l'échelle partirait à l'infini.
  const drawn = timed.flatMap((s) =>
    s.lengthM > 0 && s.durationS > 0
      ? [
          {
            startM: s.startM,
            endM: s.endM,
            sPerKm: s.durationS / (s.lengthM / 1000),
          },
        ]
      : [],
  );

  if (drawn.length === 0) return null;

  const paces = drawn.map((s) => s.sPerKm);

  return {
    segments: drawn,
    meanSPerKm: movingS / (totalM / 1000),
    slowestSPerKm: Math.max(...paces),
    fastestSPerKm: Math.min(...paces),
  };
}
