// Extensions .ts explicites : imports de valeurs, que `node` résout
// nativement dans les scripts. Voir pipeline.ts.
import { paceDrift, paceModel } from "./pace.ts";
import type { PacingProfile, ResolvedPoint, TimedPoint } from "./type.ts";

/**
 * Répartit un temps visé sur la trace. `t` est le temps cumulé depuis le
 * départ, comme `d` est la distance cumulée : toute sortie — par tronçon, par
 * kilomètre, à un ravitaillement — s'en déduit par soustraction.
 *
 * @param tempsViseS Temps total visé, en secondes.
 */
export function distributeTime(
  points: ResolvedPoint[],
  targetTimeS: number,
  profile: PacingProfile,
): TimedPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], t: 0 }];

  const totalDistance = points[points.length - 1].d - points[0].d;
  const weights = new Array<number>(points.length);
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const length = points[i].d - points[i - 1].d;

    // Deux points confondus ne coûtent rien. Sans ce garde, la pente vaut
    // `Infinity` — que `paceModel` écrête — mais un `0 / 0` donnerait `NaN`,
    // qui contaminerait le total et donc toute la trace.
    if (length <= 0) {
      weights[i] = 0;
      continue;
    }

    const slope = (points[i].ele - points[i - 1].ele) / length;
    const midpoint =
      totalDistance > 0
        ? (points[i].d + points[i - 1].d) / 2 / totalDistance
        : 0;

    weights[i] =
      length *
      paceModel(slope, profile.climbIntensity) *
      paceDrift(midpoint, profile.split);
    total += weights[i];
  }

  const result: TimedPoint[] = [{ ...points[0], t: 0 }];

  // Une trace de longueur nulle n'a rien à répartir : tout le monde à zéro,
  // sauf l'arrivée qui reçoit le temps visé juste en dessous.
  const pace = total > 0 ? targetTimeS / total : 0;
  let t = 0;

  for (let i = 1; i < points.length; i++) {
    t += weights[i] * pace;
    result.push({ ...points[i], t });
  }

  // L'accumulation flottante rate la cible de quelques microsecondes. On écrit
  // l'arrivée plutôt que de l'accumuler, pour que `t` du dernier point vaille
  // exactement le temps visé — même correctif que le dernier point de
  // `resample`.
  result[result.length - 1].t = targetTimeS;

  return result;
}
