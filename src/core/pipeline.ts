// Extensions .ts explicites : ce module est le seul du noyau à faire des
// imports de valeurs, et `node scripts/analyze.mts` les résout nativement.
// Les autres fichiers n'importent que des types, effacés à la compilation.
import { withCumulativeDistance } from "./distance.ts";
import { elevationGain, fillMissingElevation } from "./elevation.ts";
import { parseGpx } from "./parseGpx.ts";
import { resample } from "./resample.ts";
import { smooth } from "./smooth.ts";
import type { ElevatedPoint } from "./type.ts";

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
} as const;

export type Analyse = {
  nom: string | null;
  /** Points présents dans le fichier, avant tout traitement. */
  pointsBruts: number;
  /** Points écartés faute de coordonnées exploitables. */
  ecartes: number;
  distanceM: number;
  denivelePositifM: number;
  /** La trace lissée, à pas constant : ce que consomme la suite du pipeline. */
  points: ElevatedPoint[];
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
  const points = smooth(echantillonnes, reglages.medianeM, reglages.moyenneM);

  return {
    nom: trace.name,
    pointsBruts: trace.points.length,
    ecartes: trace.skipped,
    distanceM: complets[complets.length - 1].d,
    denivelePositifM: elevationGain(points, reglages.seuilM),
    points,
  };
}
