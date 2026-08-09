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
import { analyseTrace } from "./pipeline";

const reference = (nom: string) =>
  readFileSync(
    new URL(`./fixtures/references/${nom}`, import.meta.url),
    "utf8",
  );

// fichier, points bruts, écartés, distance (m), D+ (m)
// Mesuré le 9 août 2026 avec les REGLAGES de pipeline.ts.
const ATTENDU: Array<[string, number, number, number, number]> = [
  ["saintelyon.gpx", 2160, 0, 82864, 2538],
  ["saintelyon-benj.gpx", 37329, 0, 79095, 2232],
  ["saverne.gpx", 15415, 0, 28350, 1314],
  ["andlau.gpx", 11305, 0, 25352, 943],
  ["uthk.gpx", 52500, 0, 103319, 4372],
  ["utdc.gpx", 96668, 0, 159100, 6362],
  ["velo-hugo-iphone.gpx", 14213, 0, 72035, 378],
  ["course-hugo-iphone.gpx", 6606, 0, 22308, 55],
  ["utdc-karim.gpx", 77390, 0, 161928, 5620],
  ["strasparis.gpx", 72090, 0, 518367, 3177],
  ["strasparis-karim.gpx", 26450, 0, 515606, 2950],
];

test.each(
  ATTENDU,
)("%s — %i points, %i écartés, %i m, %i m D+", (fichier, pointsBruts, ecartes, distanceM, denivelePositifM) => {
  const analyse = analyseTrace(reference(fichier));

  // Comptages : entiers, comparaison exacte.
  expect(analyse.pointsBruts).toBe(pointsBruts);
  expect(analyse.ecartes).toBe(ecartes);

  // Distance et D+ : tolérance de 5 m. Les fonctions trigonométriques de la
  // bibliothèque mathématique ne sont pas garanties identiques au dernier bit
  // d'une version de V8 à l'autre, et la CI ne tourne pas sur le même Node
  // que nos machines. Cinq mètres sur 518 km valent 1e-5 — assez serré pour
  // attraper le moindre changement d'algorithme, assez lâche pour ne pas
  // rougir sur une différence d'arrondi.
  expect(analyse.distanceM).toBeCloseTo(distanceM, -1);
  expect(analyse.denivelePositifM).toBeCloseTo(denivelePositifM, -1);
});
