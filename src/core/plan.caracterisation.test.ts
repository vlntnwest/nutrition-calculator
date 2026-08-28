/**
 * Test de caractérisation du **plan**.
 *
 * `pipeline.caracterisation.test.ts` tient la trace — points, distance, D+,
 * tronçons. Il ne dit rien de ce qui en est tiré. Or une modification du modèle
 * d'allure, de la répartition du temps ou de l'allocation nutritionnelle
 * déplace les durées, les rations et les remplissages sans toucher un seul des
 * chiffres qu'il surveille.
 *
 * Comme lui, il n'affirme pas que ces valeurs sont justes : il affirme qu'elles
 * **n'ont pas changé**. Elles viennent de l'implémentation, délibérément.
 *
 * ⚠️ Quand il passe au rouge, on justifie AVANT de mettre à jour. Le diff
 * montre l'impact d'une modification sur les trois configurations d'un coup —
 * c'est ce qu'on veut lire dans une PR. Un test de caractérisation régénéré par
 * réflexe n'enregistre plus les régressions, il les entérine.
 *
 * Les trois cas couvrent des chemins distincts : deux ravitos ordinaires, la
 * course sans ravito, et un parcours long mêlant durée imposée, arrêts et
 * passage sans assistance.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { distributeTime } from "./distribute";
import { fixedSpans, movingTimeS, nutritionPlan } from "./nutrition";
import { parseGpx } from "./parseGpx";
import { prepareTrack } from "./pipeline";
import { productById } from "./products";
import type { AidStation, Product, Runner, Targets } from "./type";

const TARGETS: Targets = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 600 };
const RUNNER: Runner = {
  massKg: 70,
  flasks: [
    { volumeMl: 500, onlyWater: false },
    { volumeMl: 500, onlyWater: true },
  ],
};
const PRODUCTS = ["naak-gel-ultra", "naak-drink-ultra"].map(
  (id) => productById(id) as Product,
);

const STATIONS: Record<string, AidStation[]> = {
  "saverne.gpx": [
    { name: "A", distanceM: 9800, stopS: 300 },
    { name: "B", distanceM: 20800, stopS: 240 },
  ],
  "andlau.gpx": [],
  "uthk.gpx": [
    { name: "R1", distanceM: 22600, stopS: 480 },
    {
      name: "Sec",
      distanceM: 39800,
      providesLiquid: false,
      providesSolid: false,
    },
    { name: "R3", distanceM: 63000, stopS: 720, legDurationS: 18000 },
  ],
};

// fichier, objectif (s), durées par secteur (s), portées de liquide,
// glucides (g), liquide (mL), avertissements, sac au départ
// Mesuré le 25 août 2026 avec les REGLAGES de pipeline.ts.
//
// Saverne rejaugé le 28 août : les doses de boisson sont devenues entières, et
// un secteur porte donc un sachet là où il en prenait la moitié. Les durées et
// les portées n'ont pas bougé — le calcul d'allure n'est pas en cause — et les
// glucides non plus, 219 g avant comme après. Ce qui change est la forme du
// sac (3 boissons et 2 gels au lieu de 2,5 et 3), le liquide qui suit, et
// l'avertissement `leg-fluid-above-target` que ce sachet entier déclenche.
// andlau et uthk sont inchangés.
const EXPECTED: Array<
  [string, number, number[], number[][], number, number, number, string]
> = [
  [
    "saverne.gpx",
    13500,
    [4530, 4914, 3516],
    [[0], [1], [2]],
    219,
    1500,
    1,
    "naak-drink-ultra:3 naak-gel-ultra:2",
  ],
  [
    "andlau.gpx",
    10800,
    [10800],
    [[0]],
    190,
    500,
    1,
    "naak-drink-ultra:1 naak-gel-ultra:5",
  ],
  [
    "uthk.gpx",
    55800,
    [10293, 8141, 18000, 18166],
    [[0], [1, 2], [3]],
    922,
    2000,
    4,
    "naak-drink-ultra:4 naak-gel-ultra:26",
  ],
];

test.each(
  EXPECTED,
)("%s — objectif %i s", (file, targetTimeS, durations, liquidSpans, carbsG, fluidMl, warnings, bag) => {
  const stations = STATIONS[file];
  const points = prepareTrack(
    parseGpx(
      readFileSync(
        new URL(`./fixtures/references/${file}`, import.meta.url),
        "utf8",
      ),
    ).points,
  );
  const endM = points[points.length - 1].d;
  const plan = nutritionPlan(
    distributeTime(
      points,
      movingTimeS(targetTimeS, stations, endM),
      { climbIntensity: 0.25, split: 0 },
      fixedSpans(stations, endM),
    ),
    stations,
    RUNNER,
    TARGETS,
    PRODUCTS,
  );

  expect(plan.legs.map((l) => Math.round(l.durationS))).toEqual(durations);
  expect(plan.spans.liquid).toEqual(liquidSpans);
  expect(Math.round(plan.total.carbsG)).toBe(carbsG);
  expect(Math.round(plan.total.fluidMl)).toBe(fluidMl);
  expect(plan.warnings).toHaveLength(warnings);
  expect(
    [...plan.total.units.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${id}:${n}`)
      .join(" "),
  ).toBe(bag);

  // L'invariant du roadbook, revérifié ici sur des traces réelles : la somme
  // des durées vaut le temps de mouvement, arrêts déduits.
  const stops = stations.reduce((s, a) => s + (a.stopS ?? 0), 0);
  expect(durations.reduce((s, d) => s + d, 0)).toBe(targetTimeS - stops);
});
