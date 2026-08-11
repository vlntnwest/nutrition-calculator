// Extensions .ts explicites : ce module est le seul du noyau à faire des
// imports de valeurs, et `node scripts/analyze.mts` les résout nativement.
// Les autres fichiers n'importent que des types, effacés à la compilation.

import { withCumulativeDistance } from "./distance.ts";
import { elevationGain, fillMissingElevation } from "./elevation.ts";
import { parseGpx } from "./parseGpx.ts";
import { resample } from "./resample.ts";
import { simplifyPoints } from "./simplify.ts";
import { smooth } from "./smooth.ts";
import { splitBySlope } from "./split.ts";
import type { TrackAnalysis } from "./type.ts";

/**
 * Les réglages du noyau, rassemblés ici pour qu'il n'existe qu'un seul endroit
 * où les lire et les changer. Chacun est défendu dans un ADR ou dans
 * docs/gpx-de-reference.md, et déplacer l'un d'eux fait virer au rouge le test
 * de caractérisation — c'est le but.
 */
export const SETTINGS = {
  /** Pas du rééchantillonnage, en mètres. ADR 002. */
  stepM: 10,
  /** Fenêtre du filtre médian, en mètres. ADR 006. */
  medianM: 30,
  /** Fenêtre de la moyenne glissante. Coupée par défaut — ADR 006. */
  meanM: 0,
  /** Seuil d'hystérésis du D+, en mètres. */
  thresholdM: 0,
  /** Tolérance de simplification pour la carte, en degrés (~8 m). */
  simplifyMapDeg: 7.5e-5,
  /** Tolérance de simplification pour le profil, en mètres d'altitude. */
  simplifyProfileM: 1.5,
  /** Tolérance du découpage en tronçons, en mètres d'altitude. */
  splitToleranceM: 30,
  /** Longueur en dessous de laquelle un tronçon est fusionné, en mètres. */
  splitMinLengthM: 300,
  /** Pente en deçà de laquelle un tronçon est dit « roulant ». */
  splitFlatMax: 0.02,
} as const;

/**
 * Le chemin canonique : un GPX en entrée, une distance et un D+ en sortie.
 *
 * C'est la composition que mesure le test de caractérisation et qu'affiche
 * `npm run analyze`. Toute exploration de variantes doit se faire à côté, pas
 * en modifiant celle-ci.
 */
export function analyzeTrack(
  xml: string,
  settings: typeof SETTINGS = SETTINGS,
): TrackAnalysis {
  const trace = parseGpx(xml);
  const anchored = withCumulativeDistance(trace.points);
  const filled = fillMissingElevation(anchored);
  const resampled = resample(filled, settings.stepM);
  const smoothed = smooth(resampled, settings.medianM, settings.meanM);

  // Le pipeline se scinde ici. Le D+ se lit sur `lisses`, en pleine
  // résolution ; `simplifyPoints` ne produit que le dessin. Mesuré sur le
  // corpus, l'écart de D+ entre les deux vaut moins de 1,7 % — mais il ne
  // sort jamais du noyau, puisque le chiffre affiché vient de `lisses`.
  return {
    name: trace.name,
    rawPoints: trace.points.length,
    skipped: trace.skipped,
    distanceM: filled[filled.length - 1].d,
    ascentM: elevationGain(smoothed, settings.thresholdM),
    points: simplifyPoints(
      smoothed,
      settings.simplifyMapDeg,
      settings.simplifyProfileM,
    ),
    segments: splitBySlope(
      smoothed,
      settings.splitToleranceM,
      settings.splitMinLengthM,
      settings.splitFlatMax,
    ),
  };
}
