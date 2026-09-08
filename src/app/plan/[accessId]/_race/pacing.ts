import { distributeTime, timeSegments } from "@/core/distribute";
import { splitBySlope } from "@/core/split";
import type { PacingProfile, ProfilePoint, Segment } from "@/core/type";
import type { PaceAxisRange, PaceBand } from "@/ui/track/ElevationChart";

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

/** Les coins du rectangle que les curseurs balaient. Voir `Slider` sur l'écran Course. */
const CLIMB_BOUNDS = [0, 1] as const;
const SPLIT_BOUNDS = [-0.2, 0.2] as const;

/**
 * L'échelle de l'allure, stable pendant qu'on tient un curseur.
 *
 * `paceBand` recalcule l'allure la plus lente et la plus rapide à chaque
 * position des deux curseurs, et un axe qui s'y cale à chaque fois saute
 * sous le doigt — la ligne bouge, ce qui est attendu, mais le cadre qui la
 * mesure bouge avec elle, ce qui ne l'est pas.
 *
 * Le cadre se fixe donc sur ce que les curseurs peuvent produire au pire,
 * pas sur ce qu'ils donnent maintenant : `paceModel` répond à
 * `climbIntensity` en montée seule et `paceDrift` répond à `split`
 * linéairement, l'un et l'autre sans inversion sur leur plage — les quatre
 * coins du rectangle qu'ils balaient bornent donc tout point milieu.
 */
export function paceAxisRange(
  profile: ProfilePoint[],
  segments: Segment[],
  movingS: number | undefined,
): PaceAxisRange | null {
  const coins = CLIMB_BOUNDS.flatMap((climbIntensity) =>
    SPLIT_BOUNDS.map((split) =>
      paceBand(profile, segments, movingS, { climbIntensity, split }),
    ),
  ).filter((b): b is PaceBand => b !== null);

  if (coins.length === 0) return null;

  return {
    slowestSPerKm: Math.max(...coins.map((b) => b.slowestSPerKm)),
    fastestSPerKm: Math.min(...coins.map((b) => b.fastestSPerKm)),
  };
}
