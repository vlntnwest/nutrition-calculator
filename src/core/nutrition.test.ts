import fc from "fast-check";
import { expect, test } from "vitest";
import {
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
  nutritionPlan,
  splitByAidStation,
  suggestedTargets,
  timeAt,
} from "./nutrition";
import { CATALOG, productById } from "./products";
import type { AidStation, Product, Targets, TimedPoint } from "./type";

const RUNNER = { massKg: 70 };
const TARGETS: Targets = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 600 };

/** Une trace plate de `km` kilomètres, parcourue en `heures`. */
function flatTrack(km: number, hours: number): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= km * 100; i++) {
    points.push({
      lat: 0,
      lon: 0,
      d: i * 10,
      ele: 0,
      t: (i / (km * 100)) * hours * 3600,
    });
  }

  return points;
}

const gel = productById("naak-gel-ultra") as Product;
const drink = productById("naak-drink-ultra") as Product;
const baouwGel = productById("baouw-gel") as Product;

test("le catalogue est cohérent", () => {
  expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);

  for (const p of CATALOG) {
    expect(p.carbsG).toBeGreaterThan(0);
    expect(p.energyKcal).toBeGreaterThan(0);
    expect(p.sodiumMg).toBeGreaterThanOrEqual(0);
    // Les glucides seuls apportent déjà 4 kcal/g.
    expect(p.carbsG * 4).toBeLessThanOrEqual(p.energyKcal * 1.05);
  }
});

test("les suggestions ne sont que des suggestions", () => {
  expect(suggestedTargets(RUNNER, 1800).carbsGH).toBe(0);
  expect(suggestedTargets(RUNNER, 5400).carbsGH).toBe(30);
  expect(suggestedTargets(RUNNER, 4 * 3600).carbsGH).toBe(60);

  // Rien n'est écrêté : une saisie hors norme passe et déclenche une alerte.
  const points = flatTrack(40, 5);
  const plan = nutritionPlan(
    points,
    [],
    RUNNER,
    { carbsGH: 120, fluidMlH: 1400, sodiumMgL: 600 },
    [gel],
  );

  expect(plan.total.carbsG / 5).toBeGreaterThan(100);
  expect(plan.warnings.some((a) => a.includes("120 g/h"))).toBe(true);
  expect(plan.warnings.some((a) => a.includes("1400 mL/h"))).toBe(true);
  expect(FLUID_GUIDE_ML_H).toBe(800);
});

test("les glucides ignorent la masse, l'hydratation non", () => {
  const light = suggestedTargets({ massKg: 55 }, 4 * 3600);
  const heavy = suggestedTargets({ massKg: 95 }, 4 * 3600);

  expect(light.carbsGH).toBe(heavy.carbsGH);
  expect(heavy.fluidMlH).toBeGreaterThan(light.fluidMlH);
});

test("timeAt interpole entre deux points", () => {
  const points = flatTrack(1, 1);

  expect(timeAt(points, 0)).toBe(0);
  expect(timeAt(points, 1000)).toBeCloseTo(3600, 6);
  expect(timeAt(points, 505)).toBeCloseTo(0.505 * 3600, 3);
});

test("sans ravito, la course est un seul secteur", () => {
  const points = flatTrack(40, 5);
  const [leg, ...rest] = splitByAidStation(points, [], RUNNER);

  expect(rest).toEqual([]);
  expect(leg.name).toBe("Départ → Arrivée");
  expect(leg.startM).toBe(0);
  expect(leg.endM).toBe(40_000);
  expect(leg.durationS).toBeCloseTo(5 * 3600, 6);
});

test("les secteurs sont jointifs et couvrent la course", () => {
  const points = flatTrack(40, 5);
  const aidStations: AidStation[] = [
    { name: "AidStation 2", distanceM: 25_000 },
    { name: "AidStation 1", distanceM: 12_000 }, // volontairement désordonné
  ];
  const legs = splitByAidStation(points, aidStations, RUNNER);

  expect(legs.map((s) => s.name)).toEqual([
    "Départ → AidStation 1",
    "AidStation 1 → AidStation 2",
    "AidStation 2 → Arrivée",
  ]);
  expect(legs[0].startM).toBe(0);
  expect(legs[legs.length - 1].endM).toBe(40_000);
  for (let i = 1; i < legs.length; i++) {
    expect(legs[i].startM).toBe(legs[i - 1].endM);
  }
  expect(legs.reduce((s, x) => s + x.durationS, 0)).toBeCloseTo(5 * 3600, 6);
});

test("un ravito hors parcours est ignoré", () => {
  const points = flatTrack(40, 5);
  const legs = splitByAidStation(
    points,
    [
      { name: "Trop loin", distanceM: 90_000 },
      { name: "Avant le départ", distanceM: -500 },
    ],
    RUNNER,
  );

  expect(legs).toHaveLength(1);
});

// C'est le cœur de l'outil : « entre ces deux ravitos tu mettras 2 h, à
// 60 g/h ça fait 120 g, donc emporte ça ».
test("chaque secteur reçoit de quoi tenir jusqu'au suivant", () => {
  const points = flatTrack(40, 6);
  const plan = nutritionPlan(
    points,
    [{ name: "AidStation", distanceM: 20_000 }],
    RUNNER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.legs).toHaveLength(2);

  for (const s of plan.legs) {
    expect(s.durationS).toBeCloseTo(3 * 3600, 6);
    expect(s.need.carbsG).toBeCloseTo(180, 6);
    expect(s.supply.carbsG).toBeGreaterThanOrEqual(s.need.carbsG);
    expect(s.servings.length).toBeGreaterThan(0);
    for (const r of s.servings) {
      expect(r.units).toBeGreaterThan(0);
      expect(r.intervalS).toBeCloseTo(s.durationS / r.units, 6);
    }
  }
});

test("le sac total est la somme des secteurs", () => {
  const points = flatTrack(60, 8);
  const plan = nutritionPlan(
    points,
    [
      { name: "R1", distanceM: 20_000 },
      { name: "R2", distanceM: 40_000 },
    ],
    RUNNER,
    TARGETS,
    [gel, drink],
  );

  for (const [id, units] of plan.total.units) {
    const perLeg = plan.legs.reduce(
      (s, sec) =>
        s + (sec.servings.find((r) => r.product.id === id)?.units ?? 0),
      0,
    );
    expect(units).toBe(perLeg);
  }
  expect(plan.total.durationS).toBeCloseTo(8 * 3600, 6);
});

/**
 * Arrondir au supérieur produit par produit cumulait les excès — 225 g visés
 * devenaient 300 g. On part du plancher, donc l'excès d'un secteur ne peut
 * jamais dépasser une unité : celle qui a fait franchir la cible.
 */
test("la couverture d'un secteur ne dépasse jamais d'une unité", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 20, noNaN: true }),
      fc.double({ min: 0, max: 120, noNaN: true }),
      fc.uniqueArray(fc.constantFrom(...CATALOG), {
        minLength: 1,
        maxLength: 4,
        selector: (p) => p.id,
      }),
      (hours, carbsGH, products) => {
        const plan = nutritionPlan(
          flatTrack(10, hours),
          [],
          RUNNER,
          { ...TARGETS, carbsGH },
          products,
        );
        const leg = plan.legs[0];
        const largest = Math.max(...products.map((p) => p.carbsG));

        expect(leg.supply.carbsG).toBeGreaterThanOrEqual(
          leg.need.carbsG - 1e-9,
        );
        // Au plus une unité, et non strictement moins : la sommation
        // flottante peut faire tomber l'écart pile sur la taille de l'unité.
        expect(leg.supply.carbsG - leg.need.carbsG).toBeLessThanOrEqual(
          largest,
        );
      },
    ),
  );
});

test("le débit horaire est le même partout", () => {
  // Deux secteurs de durées très différentes : seule la durée fait varier la
  // dose, jamais le terrain.
  const points = flatTrack(40, 6);
  const plan = nutritionPlan(
    points,
    [{ name: "AidStation", distanceM: 10_000 }],
    RUNNER,
    TARGETS,
    [gel],
  );

  for (const s of plan.legs) {
    expect(s.need.carbsG / (s.durationS / 3600)).toBeCloseTo(60, 9);
  }
});

test("la dépense monte avec le dénivelé, l'apport ne la couvre pas", () => {
  // 10 km, 500 m D+, en 1 h 30 — une allure de montée plausible. À 2 km/h on
  // mangerait effectivement plus qu'on ne brûle : l'écart entre apport et
  // dépense est une propriété des allures de course, pas une identité.
  const climbing: TimedPoint[] = [];
  for (let i = 0; i <= 1000; i++) {
    climbing.push({ lat: 0, lon: 0, d: i * 10, ele: i * 0.5, t: i * 5.4 });
  }

  const relief = nutritionPlan(climbing, [], RUNNER, TARGETS, [gel]);
  const flatRace = nutritionPlan(flatTrack(10, 1.5), [], RUNNER, TARGETS, [
    gel,
  ]);

  expect(relief.total.expenditureKcal).toBeGreaterThan(
    flatRace.total.expenditureKcal,
  );
  // On ne mange jamais sa dépense : le reste vient des graisses.
  expect(relief.total.carbsG * 4).toBeLessThan(relief.total.expenditureKcal);
});

test("alerte quand on vise haut sans glucose-fructose", () => {
  const points = flatTrack(40, 5);
  const targets: Targets = { ...TARGETS, carbsGH: 80 };

  const singleSource = nutritionPlan(points, [], RUNNER, targets, [baouwGel]);
  const multi = nutritionPlan(points, [], RUNNER, targets, [gel]);

  expect(
    singleSource.warnings.some((a) => a.includes("glucose-fructose")),
  ).toBe(true);
  expect(multi.warnings.some((a) => a.includes("glucose-fructose"))).toBe(
    false,
  );
  expect(CARBS_SINGLE_SOURCE_MAX_G_H).toBe(60);
});

test("alerte quand le sodium apporté est trop bas", () => {
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [baouwGel]);

  expect(plan.warnings.some((a) => a.includes("Sodium"))).toBe(true);
});

test("l'eau claire complète la boisson", () => {
  const points = flatTrack(40, 5);

  const withDrink = nutritionPlan(points, [], RUNNER, TARGETS, [gel, drink]);
  const [s] = withDrink.legs;
  expect(s.plainWaterMl).toBeCloseTo(s.need.fluidMl - s.supply.fluidMl, 6);

  // Sur du solide seul, tout le liquide reste à boire.
  const solidOnly = nutritionPlan(points, [], RUNNER, TARGETS, [gel]);
  expect(solidOnly.legs[0].plainWaterMl).toBeCloseTo(
    solidOnly.legs[0].need.fluidMl,
    6,
  );
});

test("sans produit, le plan le dit au lieu de diviser par zéro", () => {
  const plan = nutritionPlan(flatTrack(10, 2), [], RUNNER, TARGETS, []);

  expect(plan.legs[0].servings).toEqual([]);
  expect(plan.total.carbsG).toBe(0);
  expect(plan.warnings[0]).toContain("Aucun produit");
});

/**
 * Les parts se lisent sur la liste passée par l'appelant. Un produit sans
 * glucides est écarté du calcul, mais il ne doit pas décaler les parts de ceux
 * qui le suivent.
 */
test("un produit sans glucides ne décale pas les parts", () => {
  const water: Product = {
    id: "eau-claire",
    brand: "—",
    name: "Eau claire",
    type: "drink",
    weightG: 0,
    energyKcal: 0,
    carbsG: 0,
    sodiumMg: 0,
    fluidMl: 500,
    multiTransportable: false,
  };

  const plan = nutritionPlan(
    flatTrack(40, 5),
    [],
    RUNNER,
    TARGETS,
    [water, gel, drink],
    [0, 0.9, 0.1],
  );

  const served = (id: string) =>
    plan.legs[0].servings.find((s) => s.product.id === id)?.units ?? 0;

  // 90 % des glucides sur le gel : il doit en apporter bien plus que la boisson.
  expect(served(gel.id) * gel.carbsG).toBeGreaterThan(
    served(drink.id) * drink.carbsG,
  );
});
