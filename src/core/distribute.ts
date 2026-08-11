// Extensions .ts explicites : imports de valeurs, que `node` résout
// nativement dans les scripts. Voir pipeline.ts.
import { paceDrift, paceModel } from "./pace.ts";
import type {
  PacingProfile,
  ResolvedPoint,
  Segment,
  TimedPoint,
  TimedSegment,
} from "./type.ts";

/**
 * Répartit un temps visé sur la trace. `t` est le temps cumulé depuis le
 * départ, comme `d` est la distance cumulée : toute sortie — par tronçon, par
 * kilomètre, à un ravitaillement — s'en déduit par soustraction.
 *
 * @param targetTimeS Temps total visé, en secondes.
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

    // L'origine est soustraite comme elle l'est dans `totalDistance` : sans
    // ça, une trace qui ne part pas de `d = 0` — un secteur découpé au ravito —
    // verrait toutes ses progressions dépasser 1. `paceDrift` les écrêterait à
    // 1, le facteur deviendrait constant, et la normalisation l'annulerait :
    // la dérive d'allure disparaîtrait sans le dire.
    const midpoint =
      totalDistance > 0
        ? ((points[i].d + points[i - 1].d) / 2 - points[0].d) / totalDistance
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

/** Le temps cumulé à une distance donnée, par interpolation linéaire sur `d`. */
export function timeAt(points: TimedPoint[], distanceM: number): number {
  if (points.length === 0) return 0;

  let i = 1;
  while (i < points.length - 1 && points[i].d < distanceM) i++;

  const a = points[i - 1];
  const b = points[i];
  if (b.d === a.d) return a.t;

  return a.t + ((distanceM - a.d) / (b.d - a.d)) * (b.t - a.t);
}

/**
 * Les temps de passage, tronçon par tronçon — le roadbook.
 *
 * Le calcul se réduit à deux soustractions, parce que `t` est cumulé : toute
 * la difficulté était de le répartir, pas de le relire. La finesse du
 * découpage n'entre donc pas en jeu, les temps venant du point par point.
 */
export function timeSegments(
  points: TimedPoint[],
  segments: Segment[],
): TimedSegment[] {
  return segments.map((segment) => {
    const startS = timeAt(points, segment.startM);
    const arrivalS = timeAt(points, segment.endM);
    const durationS = arrivalS - startS;

    return {
      ...segment,
      startS,
      arrivalS,
      durationS,
      speedKmh: durationS > 0 ? (segment.lengthM / durationS) * 3.6 : 0,
      vamMH: durationS > 0 ? (segment.ascentM / durationS) * 3600 : 0,
    };
  });
}
