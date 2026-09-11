import { expect, test } from "vitest";
import { pacingIssue } from "./distribute";
import {
  CARRIER,
  DRY_STOP,
  drink,
  flatTrack,
  gel,
  RUNNER,
  TARGETS,
  WATER_STOP,
} from "./fixtures/plan";
import { fixedSpans, movingTimeS, splitByAidStation } from "./legs";
import { nutritionPlan } from "./nutrition";
import type { AidStation, TimedPoint } from "./type";

test("sans ravito, la course est un seul secteur", () => {
  const points = flatTrack(40, 5);
  const [leg, ...rest] = splitByAidStation(points, [], RUNNER);

  expect(rest).toEqual([]);
  // Les deux bouts de la course n'ont pas de nom : c'est l'UI qui les nomme.
  expect(leg.from).toBeNull();
  expect(leg.to).toBeNull();
  expect(leg.startM).toBe(0);
  expect(leg.endM).toBe(40_000);
  expect(leg.durationS).toBeCloseTo(5 * 3600, 6);
});

test("les secteurs sont jointifs et couvrent la course", () => {
  const points = flatTrack(40, 5);
  const aidStations: AidStation[] = [
    { name: "Ravito 2", distanceM: 25_000 },
    { name: "Ravito 1", distanceM: 12_000 }, // volontairement désordonné
  ];
  const legs = splitByAidStation(points, aidStations, RUNNER);

  expect(legs.map((s) => [s.from, s.to])).toEqual([
    [null, "Ravito 1"],
    ["Ravito 1", "Ravito 2"],
    ["Ravito 2", null],
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

test("la dépense monte avec le dénivelé, l'apport ne la couvre pas", () => {
  // 10 km, 500 m D+, en 1 h 30 — une allure de montée plausible. À 2 km/h on
  // mangerait effectivement plus qu'on ne brûle : l'écart entre apport et
  // dépense est une propriété des allures de course, pas une identité.
  const climbing: TimedPoint[] = [];
  for (let i = 0; i <= 1000; i++) {
    climbing.push({ d: i * 10, ele: i * 0.5, t: i * 5.4 });
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

// ─────────────────────────────────────────────── Les arrêts aux ravitos

test("un arrêt ne rallonge aucun secteur : il décale les horaires", () => {
  // `flatTrack` porte 5 h de **mouvement** — c'est ce que `distributeTime`
  // répartit une fois les arrêts retranchés du temps visé.
  const points = flatTrack(40, 5);
  const aidStations: AidStation[] = [
    { name: "Ravito 1", distanceM: 10_000, stopS: 600 },
    { name: "Ravito 2", distanceM: 30_000, stopS: 300 },
  ];
  const legs = splitByAidStation(points, aidStations, RUNNER);

  // Trois secteurs de 10, 20 et 10 km sur une trace plate : 1 h 15, 2 h 30,
  // 1 h 15 de mouvement. Aucune de ces durées ne bouge à cause d'un arrêt.
  expect(legs.map((s) => s.durationS)).toEqual([4500, 9000, 4500]);
  expect(legs.map((s) => s.stopS)).toEqual([600, 300, 0]);

  // Les horaires, eux, encaissent tout ce qui a été perdu en amont.
  expect(legs.map((s) => s.startS)).toEqual([0, 4500 + 600, 13_500 + 900]);
  expect(legs.map((s) => s.arrivalS)).toEqual([
    4500,
    13_500 + 600,
    18_000 + 900,
  ]);

  // L'invariant qui tient l'ensemble.
  for (const s of legs) expect(s.arrivalS - s.startS).toBe(s.durationS);
});

test("le temps de mouvement retranche les arrêts du temps visé", () => {
  const aidStations: AidStation[] = [
    { name: "A", distanceM: 10_000, stopS: 600 },
    { name: "B", distanceM: 30_000, stopS: 300 },
  ];

  expect(movingTimeS(6 * 3600, aidStations, 40_000)).toBe(6 * 3600 - 900);
});

test("un ravito hors parcours ne retranche rien", () => {
  // Le filtre doit être le même des deux côtés : retrancher l'arrêt d'un
  // ravito que le découpage ignore ferait manquer l'objectif en silence.
  const beyond: AidStation[] = [
    { name: "Trop loin", distanceM: 90_000, stopS: 600 },
  ];

  expect(movingTimeS(6 * 3600, beyond, 40_000)).toBe(6 * 3600);
  expect(splitByAidStation(flatTrack(40, 5), beyond, RUNNER)).toHaveLength(1);
});

test("des arrêts qui mangent l'objectif sont refusés", () => {
  const aidStations: AidStation[] = [
    { name: "A", distanceM: 10_000, stopS: 7200 },
  ];

  expect(() => movingTimeS(3600, aidStations, 40_000)).toThrow();

  // Le refus porte ses chiffres : l'appelant propose la correction, le noyau
  // ne rédige pas de phrase.
  try {
    movingTimeS(3600, aidStations, 40_000);
  } catch (error) {
    expect(pacingIssue(error)).toEqual({
      code: "stops-above-target",
      stopS: 7200,
      targetTimeS: 3600,
    });
  }
});

test("les arrêts ne consomment pas de produits", () => {
  const points = flatTrack(40, 5);
  const products = [gel, drink];
  const withoutStops = nutritionPlan(points, [], RUNNER, TARGETS, products);
  const withStops = nutritionPlan(
    points,
    [{ name: "Ravito 1", distanceM: 20_000, stopS: 1800 }],
    RUNNER,
    TARGETS,
    products,
  );

  // Même temps de mouvement des deux côtés, donc même besoin total : la
  // demi-heure passée debout à une table se ravitaille sur place.
  expect(withStops.total.durationS).toBeCloseTo(
    withoutStops.total.durationS,
    6,
  );
  expect(withStops.total.stopS).toBe(1800);
  expect(withStops.total.elapsedS).toBeCloseTo(
    withoutStops.total.durationS + 1800,
    6,
  );
});

// ───────────────────────────────────────────────── Les durées imposées

test("une durée imposée devient la portion qui va du ravito précédent", () => {
  const aidStations: AidStation[] = [
    { name: "A", distanceM: 10_000 },
    { name: "B", distanceM: 25_000, legDurationS: 7200 },
    { name: "C", distanceM: 30_000, legDurationS: 1800 },
  ];

  // « B » impose le secteur A → B, pas le parcours depuis le départ : un
  // ravito sans consigne borne quand même la portion qui le suit.
  expect(fixedSpans(aidStations, 40_000)).toEqual([
    { startM: 10_000, endM: 25_000, durationS: 7200 },
    { startM: 25_000, endM: 30_000, durationS: 1800 },
  ]);
});

test("un ravito hors parcours n'impose rien", () => {
  // Le même filtre que `movingTimeS` et `splitByAidStation` : une consigne
  // portée par un ravito que le découpage ignore ne doit pas retrancher du
  // temps que personne ne parcourra.
  const aidStations: AidStation[] = [
    { name: "Trop loin", distanceM: 90_000, legDurationS: 3600 },
    { name: "À l'arrivée", distanceM: 40_000, legDurationS: 3600 },
    { name: "A", distanceM: 20_000, legDurationS: 5400 },
  ];

  expect(fixedSpans(aidStations, 40_000)).toEqual([
    { startM: 0, endM: 20_000, durationS: 5400 },
  ]);
});

test("le dernier secteur se règle comme les autres", () => {
  const aidStations: AidStation[] = [
    { name: "A", distanceM: 10_000 },
    { name: "B", distanceM: 25_000, legDurationS: 7200 },
  ];

  // Aucun ravito ne clôt le dernier secteur : sa consigne arrive à part, et
  // porte de la dernière borne à l'arrivée.
  expect(fixedSpans(aidStations, 40_000, 3600)).toEqual([
    { startM: 10_000, endM: 25_000, durationS: 7200 },
    { startM: 25_000, endM: 40_000, durationS: 3600 },
  ]);

  // Seul, il part du départ : un parcours sans ravito n'a qu'un secteur.
  expect(fixedSpans([], 40_000, 3600)).toEqual([
    { startM: 0, endM: 40_000, durationS: 3600 },
  ]);
});

test("l'arrêt d'un ravito n'entre pas dans la durée imposée", () => {
  const aidStations: AidStation[] = [
    { name: "A", distanceM: 20_000, stopS: 600, legDurationS: 5400 },
  ];

  // Deux consignes indépendantes : 1 h 30 de mouvement jusqu'au ravito, puis
  // 10 min sur place retranchées du temps visé.
  expect(fixedSpans(aidStations, 40_000)).toEqual([
    { startM: 0, endM: 20_000, durationS: 5400 },
  ]);
  expect(movingTimeS(4 * 3600, aidStations, 40_000)).toBe(4 * 3600 - 600);
});

test("sans mention contraire, chaque ravito rouvre le portage", () => {
  // Le même parcours, mais le ravito de 20 km fournit de l'eau : trois
  // portées d'un secteur, aucune ne dépasse la contenance.
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, { name: "Ravito", distanceM: 20_000 }],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.legs.every((leg) => leg.fills.length > 0)).toBe(true);
  expect(
    plan.warnings.filter((w) => w.code === "leg-fluid-above-carry"),
  ).toEqual([]);
});

/**
 * Les deux portées sont indépendantes : un ravito peut avoir de l'eau sans
 * nourriture, et l'inverse. Le solide n'a pas de contenance déclarée, donc
 * pas d'avertissement — seulement un découpage.
 */
test("un ravito sans solide ne rouvre pas le sac", () => {
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, { ...DRY_STOP, providesLiquid: true, providesSolid: false }],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  // De l'eau aux deux ravitos, mais rien à manger au second.
  expect(plan.spans.liquid).toEqual([[0], [1], [2]]);
  expect(plan.spans.solid).toEqual([[0], [1, 2]]);
});

test("un passage sans assistance ne rouvre rien", () => {
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [
      WATER_STOP,
      {
        name: "Col",
        distanceM: 20_000,
        providesLiquid: false,
        providesSolid: false,
      },
    ],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.spans.liquid).toEqual([[0], [1, 2]]);
  expect(plan.spans.solid).toEqual([[0], [1, 2]]);
});

test("sans mention contraire, chaque ravito rouvre les deux", () => {
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, { name: "Ravito", distanceM: 20_000 }],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.spans.liquid).toEqual([[0], [1], [2]]);
  expect(plan.spans.solid).toEqual([[0], [1], [2]]);
});
