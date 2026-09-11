import { expect, test } from "vitest";
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
import { nutritionPlan } from "./nutrition";
import type { Runner } from "./type";

/**
 * La ventilation par contenant. Un contenant ne porte qu'une chose : compléter
 * une boisson à l'eau en changerait la concentration, c'est une règle physique
 * et pas une simplification.
 */
test("chaque flasque porte une seule chose", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 500, onlyWater: true },
    ],
  };
  // 5 h à 500 mL/h : 2 500 mL réclamés pour 1 000 mL portés.
  const leg = nutritionPlan(flatTrack(40, 5), [], runner, TARGETS, [gel, drink])
    .legs[0];

  expect(leg.fills).toEqual([
    { flaskIndex: 0, product: drink, volumeMl: 500 },
    { flaskIndex: 1, product: null, volumeMl: 500 },
  ]);
  expect(leg.refillMl).toBeCloseTo(1500, 6);
  expect(new Set(leg.fills.map((f) => f.flaskIndex)).size).toBe(
    leg.fills.length,
  );

  // Contenance non déclarée : le noyau ne ventile rien plutôt que de supposer
  // un matériel qu'on ne lui a pas donné.
  const bare = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [
    gel,
    drink,
  ]).legs[0];
  expect(bare.fills).toEqual([]);
  expect(bare.refillMl).toBe(0);
});

/**
 * On ne part pas avec un fond de flasque : on la remplit, et on emporte du
 * rab plutôt que de risquer d'en manquer. Ce qu'il faut boire est dit à
 * part, par `need.fluidMl`.
 */
test("une flasque emportée part pleine", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 500, onlyWater: true },
      { volumeMl: 500, onlyWater: true },
    ],
  };
  // 1 h 30 à 500 mL/h = 750 mL : une flasque de boisson, une d'eau pleine —
  // 1 000 mL portés pour 750 à boire — et la troisième reste au sac.
  const leg = nutritionPlan(flatTrack(12, 1.5), [], runner, TARGETS, [
    gel,
    drink,
  ]).legs[0];

  expect(leg.fills).toEqual([
    { flaskIndex: 0, product: drink, volumeMl: 500 },
    { flaskIndex: 1, product: null, volumeMl: 500 },
  ]);
  expect(leg.refillMl).toBe(0);
  // Ce qu'il faut boire, lui, ne bouge pas : 1 h 30 à 500 mL/h.
  expect(leg.need.fluidMl).toBeCloseTo(750, 6);
});

/**
 * Une flasque plus grande que le sachet part pleine quand même : la boisson
 * est diluée, et c'est un choix — mieux vaut de la boisson faible que rien à
 * boire. Le noyau le dit par la contenance versée.
 */
test("un sachet trop petit pour la flasque la remplit quand même", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [{ volumeMl: 750, onlyWater: false }],
  };
  const leg = nutritionPlan(flatTrack(12, 1.5), [], runner, TARGETS, [
    gel,
    drink,
  ]).legs[0];

  expect(leg.fills[0]).toMatchObject({ flaskIndex: 0, volumeMl: 750 });
});

test("on ne remplit qu'à l'ouverture d'une portée", () => {
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, DRY_STOP],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  // Le secteur 2 part d'un ravito sec : rien à y verser.
  expect(plan.legs[2].fills).toEqual([]);
  expect(plan.legs[2].refillMl).toBe(0);

  // Tout le liquide de la portée est versé à son ouverture, et ce qui ne tient
  // pas dans les flasques ressort plutôt que de disparaître.
  expect(plan.legs[1].fills.length).toBeGreaterThan(0);
  expect(plan.legs[1].refillMl).toBeCloseTo(500, 6);
});

test("des remplissages imposés remplacent le calcul des flasques", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [{ volumeMl: 500, onlyWater: false }],
  };
  const impose = nutritionPlan(flatTrack(20, 3), [], runner, TARGETS, [gel], {
    imposed: {
      servings: [[{ productId: gel.id, units: 2 }]],
      // Le calcul, lui, part toujours flasque pleine : 200 ne peut venir
      // que de la consigne.
      fills: [[{ flaskIndex: 0, productId: null, volumeMl: 200 }]],
    },
  });

  expect(impose.legs[0].fills).toEqual([
    { flaskIndex: 0, product: null, volumeMl: 200 },
  ]);
});

test("ce que les flasques imposées ne portent pas ressort en refillMl", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [{ volumeMl: 500, onlyWater: false }],
  };
  const impose = nutritionPlan(flatTrack(20, 3), [], runner, TARGETS, [gel], {
    imposed: {
      servings: [[{ productId: gel.id, units: 2 }]],
      fills: [[{ flaskIndex: 0, productId: null, volumeMl: 200 }]],
    },
  });

  // 500 mL/h sur 3 h : 1500 mL à couvrir, la consigne en porte 200.
  expect(impose.legs[0].refillMl).toBeCloseTo(1300);
});

test("une flasque qu'on impose vide reste vide", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [{ volumeMl: 500, onlyWater: false }],
  };
  const impose = nutritionPlan(
    flatTrack(20, 3),
    [],
    runner,
    TARGETS,
    [gel, drink],
    {
      // Le calcul remplirait la flasque de boisson ; on part sans.
      imposed: {
        servings: [[{ productId: drink.id, units: 1 }]],
        fills: [[]],
      },
    },
  );

  expect(impose.legs[0].fills).toEqual([]);
  expect(impose.legs[0].refillMl).toBeCloseTo(1500);
});

test("un remplissage imposé hors de l'ouverture de la portée se refuse", () => {
  // La portée [1, 2] s'ouvre au point d'eau : le passage sec ne rouvre rien.
  // Verser sur le secteur 2, c'est remplir une flasque restée à la maison.
  expect(() =>
    nutritionPlan(
      flatTrack(40, 4),
      [WATER_STOP, DRY_STOP],
      CARRIER,
      TARGETS,
      [gel, drink],
      {
        imposed: {
          servings: [[], [], []],
          fills: [
            [{ flaskIndex: 0, productId: null, volumeMl: 500 }],
            [{ flaskIndex: 0, productId: null, volumeMl: 500 }],
            [{ flaskIndex: 0, productId: null, volumeMl: 500 }],
          ],
        },
      },
    ),
  ).toThrow(/carry span/);
});

test("une portée ne porte que ce qu'elle a versé à son ouverture", () => {
  const impose = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, DRY_STOP],
    CARRIER,
    TARGETS,
    [gel, drink],
    {
      imposed: {
        servings: [[], [], []],
        fills: [
          [{ flaskIndex: 0, productId: null, volumeMl: 500 }],
          [{ flaskIndex: 0, productId: null, volumeMl: 500 }],
          [],
        ],
      },
    },
  );

  // La portée couvre 1 h puis 2 h, soit 1 500 mL, dont 500 portés au départ.
  expect(impose.legs[1].refillMl).toBeCloseTo(1000);
  expect(impose.legs[2].fills).toEqual([]);
});
