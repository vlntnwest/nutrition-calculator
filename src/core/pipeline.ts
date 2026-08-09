// Extensions .ts explicites : ce module est le seul du noyau à faire des
// imports de valeurs, et `node scripts/analyze.mts` les résout nativement.
// Les autres fichiers n'importent que des types, effacés à la compilation.
import { decoupeParPente, type Troncon } from "./decoupe.ts";
import { withCumulativeDistance } from "./distance.ts";
import { elevationGain, fillMissingElevation } from "./elevation.ts";
import { parseGpx } from "./parseGpx.ts";
import { resample } from "./resample.ts";
import { simplifyPoints } from "./simplify.ts";
import { smooth } from "./smooth.ts";
import type { ResolvedPoint } from "./type.ts";

/**
 * Les réglages du noyau, rassemblés ici pour qu'il n'existe qu'un seul endroit
 * où les lire et les changer. Chacun est défendu dans un ADR ou dans
 * docs/gpx-de-reference.md, et déplacer l'un d'eux fait virer au rouge le test
 * de caractérisation — c'est le but.
 */
export const REGLAGES = {
  /** Pas du rééchantillonnage, en mètres. ADR 002. */
  pasM: 10,
  /** Fenêtre du filtre médian, en mètres. ADR 006. */
  medianeM: 30,
  /** Fenêtre de la moyenne glissante. Coupée par défaut — ADR 006. */
  moyenneM: 0,
  /** Seuil d'hystérésis du D+, en mètres. */
  seuilM: 0,
  /** Tolérance de simplification pour la carte, en degrés (~8 m). */
  simplifieCarteDeg: 7.5e-5,
  /** Tolérance de simplification pour le profil, en mètres d'altitude. */
  simplifieProfilM: 1.5,
  /** Tolérance du découpage en tronçons, en mètres d'altitude. */
  decoupeToleranceM: 30,
  /** Longueur en dessous de laquelle un tronçon est fusionné, en mètres. */
  decoupeLongueurMinM: 300,
  /** Pente en deçà de laquelle un tronçon est dit « roulant ». */
  decoupeRoulantMax: 0.02,
} as const;

export type Analyse = {
  nom: string | null;
  /** Points présents dans le fichier, avant tout traitement. */
  pointsBruts: number;
  /** Points écartés faute de coordonnées exploitables. */
  ecartes: number;
  distanceM: number;
  /**
   * Calculé sur la trace lissée en **pleine résolution**, jamais sur la trace
   * simplifiée. C'est ce scalaire qui fait autorité et qui sera stocké ; les
   * points ci-dessous ne servent qu'à dessiner. §14.3.
   */
  denivelePositifM: number;
  /**
   * La trace simplifiée : ~2 000 points, ce qui part en `jsonb` et alimente
   * la carte et le profil.
   */
  points: ResolvedPoint[];
  /**
   * Le parcours découpé en morceaux de pente homogène. Comme le D+, ils sont
   * lus sur la trace pleine résolution, jamais sur la simplifiée.
   */
  troncons: Troncon[];
};

/**
 * Le chemin canonique : un GPX en entrée, une distance et un D+ en sortie.
 *
 * C'est la composition que mesure le test de caractérisation et qu'affiche
 * `npm run analyze`. Toute exploration de variantes doit se faire à côté, pas
 * en modifiant celle-ci.
 */
export function analyseTrace(
  xml: string,
  reglages: typeof REGLAGES = REGLAGES,
): Analyse {
  const trace = parseGpx(xml);
  const ancres = withCumulativeDistance(trace.points);
  const complets = fillMissingElevation(ancres);
  const echantillonnes = resample(complets, reglages.pasM);
  const lisses = smooth(echantillonnes, reglages.medianeM, reglages.moyenneM);

  // Le pipeline se scinde ici. Le D+ se lit sur `lisses`, en pleine
  // résolution ; `simplifyPoints` ne produit que le dessin. Mesuré sur le
  // corpus, l'écart de D+ entre les deux vaut moins de 1,7 % — mais il ne
  // sort jamais du noyau, puisque le chiffre affiché vient de `lisses`.
  return {
    nom: trace.name,
    pointsBruts: trace.points.length,
    ecartes: trace.skipped,
    distanceM: complets[complets.length - 1].d,
    denivelePositifM: elevationGain(lisses, reglages.seuilM),
    points: simplifyPoints(
      lisses,
      reglages.simplifieCarteDeg,
      reglages.simplifieProfilM,
    ),
    troncons: decoupeParPente(
      lisses,
      reglages.decoupeToleranceM,
      reglages.decoupeLongueurMinM,
      reglages.decoupeRoulantMax,
    ),
  };
}
