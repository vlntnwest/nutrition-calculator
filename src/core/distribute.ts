// Extensions .ts explicites : imports de valeurs, que `node` résout
// nativement dans les scripts. Voir pipeline.ts.
import { paceDrift, paceModel } from "./pace.ts";
import type {
  FixedSpan,
  PacingIssue,
  PacingProfile,
  ResolvedPoint,
  Segment,
  TimedPoint,
  TimedSegment,
} from "./type.ts";

/**
 * Une erreur porteuse de ses chiffres. Le message est pour qui lit une trace
 * d'exécution ; `cause` est pour l'appelant, qui veut proposer une correction
 * plutôt que relayer une phrase.
 */
export function pacingError(issue: PacingIssue, message: string): Error {
  return new Error(message, { cause: issue });
}

/**
 * L'empêchement porté par une erreur, `null` si elle vient d'ailleurs — une
 * exception du runtime n'est pas un plan infaisable, et l'appelant doit
 * pouvoir la laisser passer.
 */
export function pacingIssue(error: unknown): PacingIssue | null {
  const cause = error instanceof Error ? error.cause : null;

  return typeof cause === "object" && cause !== null && "code" in cause
    ? (cause as PacingIssue)
    : null;
}

/**
 * Répartit un temps visé sur la trace. `t` est le temps cumulé depuis le
 * départ, comme `d` est la distance cumulée : toute sortie — par tronçon, par
 * kilomètre, à un ravitaillement — s'en déduit par soustraction.
 *
 * @param targetTimeS Temps total visé, en secondes. Du temps de **mouvement**
 *   quand des arrêts sont prévus aux ravitos : voir `movingTimeS`.
 * @param fixed Portions dont la durée est imposée. Elles sont servies
 *   d'abord ; le temps qui reste va aux portions libres, qui s'accélèrent
 *   d'autant.
 */
export function distributeTime(
  points: ResolvedPoint[],
  targetTimeS: number,
  profile: PacingProfile,
  fixed: FixedSpan[] = [],
): TimedPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], t: 0 }];

  const totalDistance = points[points.length - 1].d - points[0].d;
  const weights = new Array<number>(points.length);
  /** La portion imposée de chaque intervalle, `-1` pour une portion libre. */
  const spans = new Array<number>(points.length);
  const fixedWeights = fixed.map(() => 0);
  let freeWeight = 0;

  for (let i = 1; i < points.length; i++) {
    const length = points[i].d - points[i - 1].d;

    // Deux points confondus ne coûtent rien. Sans ce garde, la pente vaut
    // `Infinity` — que `paceModel` écrête — mais un `0 / 0` donnerait `NaN`,
    // qui contaminerait le total et donc toute la trace.
    if (length <= 0) {
      weights[i] = 0;
      spans[i] = -1;
      continue;
    }

    const slope = (points[i].ele - points[i - 1].ele) / length;
    const middleM = (points[i].d + points[i - 1].d) / 2;

    // L'origine est soustraite comme elle l'est dans `totalDistance` : sans
    // ça, une trace qui ne part pas de `d = 0` — un secteur découpé au ravito —
    // verrait toutes ses progressions dépasser 1. `paceDrift` les écrêterait à
    // 1, le facteur deviendrait constant, et la normalisation l'annulerait :
    // la dérive d'allure disparaîtrait sans le dire.
    //
    // Pour la même raison, les poids se calculent sur la trace **entière**,
    // avant tout découpage en portions : les recalculer portion par portion
    // ferait repartir la dérive à zéro à chaque ravito. Seule l'allure
    // appliquée ci-dessous change d'une portion à l'autre.
    const progress =
      totalDistance > 0 ? (middleM - points[0].d) / totalDistance : 0;

    weights[i] =
      length *
      paceModel(slope, profile.climbIntensity) *
      paceDrift(progress, profile.split);

    // L'appartenance se décide sur le **milieu** de l'intervalle : sur ses
    // bornes, celui qui tombe pile à un ravito serait compté des deux côtés.
    const span = fixed.findIndex(
      (s) => middleM >= s.startM && middleM < s.endM,
    );
    spans[i] = span;
    if (span >= 0) fixedWeights[span] += weights[i];
    else freeWeight += weights[i];
  }

  const fixedS = fixed.reduce((s, span) => s + span.durationS, 0);

  // Une durée imposée se sert avant tout le reste : au-delà de l'objectif,
  // elle ne laisse pas un parcours plus lent, elle ne laisse aucun parcours.
  if (fixedS > targetTimeS) {
    throw pacingError(
      { code: "fixed-above-target", fixedS, targetTimeS },
      "Fixed spans exceed the target time",
    );
  }

  // Plus une seconde de libre pour rattraper l'écart : le taire ferait manquer
  // l'objectif à l'arrivée sans que rien ne le signale.
  if (freeWeight <= 0 && fixed.length > 0 && fixedS !== targetTimeS) {
    throw pacingError(
      { code: "fixed-miss-target", fixedS, targetTimeS },
      "Fixed spans cover the whole track but miss the target",
    );
  }

  const result: TimedPoint[] = [{ ...points[0], t: 0 }];

  // Une trace de longueur nulle n'a rien à répartir : tout le monde à zéro,
  // sauf l'arrivée qui reçoit le temps visé juste en dessous.
  const freePace = freeWeight > 0 ? (targetTimeS - fixedS) / freeWeight : 0;
  const fixedPaces = fixed.map((span, k) =>
    fixedWeights[k] > 0 ? span.durationS / fixedWeights[k] : 0,
  );
  let t = 0;

  for (let i = 1; i < points.length; i++) {
    const span = spans[i];
    t += weights[i] * (span >= 0 ? fixedPaces[span] : freePace);
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
  // Il faut deux points pour interpoler. Avec un seul, `points[1]` n'existe
  // pas et la lecture de `b.d` lève. `distributeTime` protège ce cas chez
  // elle, mais `timeAt` est exportée et `timeSegments` l'appelle directement.
  if (points.length < 2) return points[0]?.t ?? 0;

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
