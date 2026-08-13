/**
 * Test de caractérisation.
 *
 * Il n'affirme pas que ces chiffres sont justes — personne ne peut le faire,
 * Strava et Garmin ne sont pas d'accord entre eux sur les mêmes fichiers. Il
 * affirme qu'ils **n'ont pas changé**.
 *
 * C'est la seule exception assumée à la règle « une valeur attendue vient d'une
 * source indépendante de l'implémentation » : ici elle vient de
 * l'implémentation, délibérément, pour détecter le changement plutôt que
 * vérifier la justesse.
 *
 * ⚠️ Quand il passe au rouge, on justifie AVANT de mettre à jour. Le diff
 * montre l'impact d'une modification sur les onze fichiers d'un coup — c'est
 * précisément ce qu'on veut lire dans une PR. Un test de caractérisation
 * régénéré par réflexe n'enregistre plus les régressions, il les entérine.
 *
 * La justesse, elle, s'apprécie avec `npm run analyze`, qui confronte ces
 * mêmes fichiers aux lectures de Strava. Voir docs/gpx-de-reference.md.
 *
 * C'est le test le plus lent du dépôt — ~4 s pour 88 Mo de GPX, contre 200 ms
 * pour tout le reste.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { analyzeTrack } from "./pipeline";

const reference = (name: string) =>
  readFileSync(
    new URL(`./fixtures/references/${name}`, import.meta.url),
    "utf8",
  );

// fichier, points bruts, écartés, distance (m), D+ (m), points simplifiés, tronçons
// Mesuré le 9 août 2026 avec les REGLAGES de pipeline.ts.
const EXPECTED: Array<
  [string, number, number, number, number, number, number]
> = [
  ["saintelyon.gpx", 2160, 0, 82864, 2538, 1226, 54],
  ["saintelyon-benj.gpx", 37329, 0, 79095, 2232, 1293, 57],
  ["saverne.gpx", 15415, 0, 28350, 1314, 708, 28],
  ["andlau.gpx", 11305, 0, 25352, 943, 498, 17],
  ["uthk.gpx", 52500, 0, 103319, 4372, 2036, 74],
  ["utdc.gpx", 96668, 0, 159100, 6362, 2916, 111],
  ["velo-hugo-iphone.gpx", 14213, 0, 72035, 378, 651, 8],
  ["course-hugo-iphone.gpx", 6606, 0, 22308, 55, 275, 1],
  ["utdc-karim.gpx", 77390, 0, 161928, 5620, 2860, 114],
  ["strasparis.gpx", 72090, 0, 518367, 3177, 3493, 66],
  ["strasparis-karim.gpx", 26450, 0, 515606, 2950, 3436, 50],
];

test.each(
  EXPECTED,
)("%s — %i points, %i écartés, %i m, %i m D+, %i points gardés, %i tronçons", (file, rawPoints, skipped, distanceM, ascentM, simplified, segments) => {
  const analysis = analyzeTrack(reference(file));

  // Comptages : entiers, comparaison exacte.
  expect(analysis.rawPoints).toBe(rawPoints);
  expect(analysis.skipped).toBe(skipped);
  expect(analysis.points.length).toBe(simplified);
  expect(analysis.segments.length).toBe(segments);

  // Les tronçons partitionnent la trace : ils sont jointifs, ils la couvrent
  // d'un bout à l'autre, et leur D+ se resomme au total. Cette dernière
  // égalité n'est vraie qu'à seuil d'hystérésis nul — la relâcher voudrait
  // dire qu'on a changé `seuilM` sans y penser.
  expect(analysis.segments[0].startM).toBe(0);
  expect(analysis.segments[analysis.segments.length - 1].endM).toBeCloseTo(
    analysis.distanceM,
    -1,
  );
  for (let i = 1; i < analysis.segments.length; i++) {
    expect(analysis.segments[i].startM).toBe(analysis.segments[i - 1].endM);
  }
  expect(
    analysis.segments.reduce((total, t) => total + t.ascentM, 0),
  ).toBeCloseTo(analysis.ascentM, 6);

  // Distance et D+ : tolérance de 5 m. Les fonctions trigonométriques de la
  // bibliothèque mathématique ne sont pas garanties identiques au dernier bit
  // d'une version de V8 à l'autre, et la CI ne tourne pas sur le même Node
  // que nos machines. Cinq mètres sur 518 km valent 1e-5 — assez serré pour
  // attraper le moindre changement d'algorithme, assez lâche pour ne pas
  // rougir sur une différence d'arrondi.
  // Le D+ est lu sur la trace pleine résolution, jamais sur la simplifiée qui
  // en perd jusqu'à 1,7 %. C'est cette assertion qui verrouille la séparation
  // du §14.3 : recâbler `elevationGain` sur `points` la ferait rougir.
  expect(analysis.distanceM).toBeCloseTo(distanceM, -1);
  expect(analysis.ascentM).toBeCloseTo(ascentM, -1);
});
