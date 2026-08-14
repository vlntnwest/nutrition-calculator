/**
 * Test de justesse — le pendant de `pipeline.caracterisation.test.ts`.
 *
 * La caractérisation dit « ça n'a pas changé ». Celui-ci dit « ça reste proche
 * du réel ». Les deux sont nécessaires : un noyau peut dériver lentement sans
 * jamais casser sa propre empreinte.
 *
 * La référence est **Strava**, pas le D+ officiel des courses. Le §15.3 de la
 * spec demandait dix parcours dont le D+ officiel est publié ; le corpus n'en
 * a que deux, parce que la plupart des organisations ne le publient pas, et
 * que celles qui le publient annoncent un chiffre arrondi de leur créateur de
 * parcours. Strava est imparfait mais mesuré sur le même fichier, et Garmin
 * est écarté depuis qu'on l'a vu annoncer 2222 puis 3263 m sur la même trace.
 * Voir docs/gpx-de-reference.md.
 *
 * La tolérance est **large et assumée** : ±10 %. Ce n'est pas une mesure de
 * justesse au sens strict — personne ne peut la faire, les outils du marché
 * n'étant pas d'accord entre eux — c'est un garde-fou contre la dérive. Le
 * jour où un réglage nous éloigne du réel de plus de 10 %, on veut l'apprendre
 * ici et pas en course.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import manifest from "./fixtures/references/manifest.json" with {
  type: "json",
};
import { analyzeTrack } from "./pipeline";

/** Écart maximal toléré au D+ lu par Strava sur le même fichier. */
const TOLERANCE = 0.1;

/**
 * Seules les traces de course à pied enregistrées à la montre entrent dans le
 * test. Le fichier téléphone est exclu faute de référence utilisable — Strava
 * annonce 30 m sur le semi-marathon, Garmin 291 sur le même fichier — et les
 * traces de vélo le sont parce qu'elles sont hors périmètre V1 : 2 500 m de D+
 * sur 518 km, c'est un rapport signal/bruit qui appelle un autre seuil.
 */
const running = manifest.filter(
  (m) => m.type === "trace-montre" && m.strava?.ascentM,
);

test("le corpus de référence couvre au moins cinq traces de course", () => {
  expect(running.length).toBeGreaterThanOrEqual(5);
});

test.each(
  running.map((m) => [m.file, m.strava?.ascentM ?? 0] as const),
)("%s — D+ proche des %i m lus par Strava", (file, stravaAscentM) => {
  const analysis = analyzeTrack(
    readFileSync(
      new URL(`./fixtures/references/${file}`, import.meta.url),
      "utf8",
    ),
  );

  expect(Math.abs(analysis.ascentM / stravaAscentM - 1)).toBeLessThan(
    TOLERANCE,
  );
});

/**
 * La distance, elle, est mesurée et non modélisée : haversine sur des points
 * GPS ne laisse aucune latitude d'interprétation. On l'exige vingt fois plus
 * serrée que le D+, et sur **tous** les fichiers, y compris ceux dont le D+
 * est inexploitable — un téléphone situe mal l'altitude, pas la position.
 *
 * La référence est ici **Garmin** et non Strava, qui gonfle systématiquement
 * de 1 à 2 %. Garmin est écarté pour le D+ parce qu'il substitue son propre
 * modèle de terrain aux altitudes du fichier ; il ne substitue rien aux
 * coordonnées.
 */
const measured = manifest.filter((m) => m.garmin?.distanceKm);

test.each(
  measured.map((m) => [m.file, m.garmin?.distanceKm ?? 0] as const),
)("%s — distance proche des %f km lus par Garmin", (file, garminKm) => {
  const analysis = analyzeTrack(
    readFileSync(
      new URL(`./fixtures/references/${file}`, import.meta.url),
      "utf8",
    ),
  );

  expect(Math.abs(analysis.distanceM / (garminKm * 1000) - 1)).toBeLessThan(
    0.005,
  );
});
