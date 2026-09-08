import { expect, test } from "vitest";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { flaskCapacityUnits, servingStep, withFill, withServing } from "./edit";

type Leg = Roadbook["legs"][number];

const CATALOGUE: Roadbook["catalogue"] = [
  {
    id: "gel-1",
    name: "Gel citron",
    brandName: "Marque",
    divisibleBy: 1,
    formatLabel: "gel",
    carbsG: 25,
    energyKcal: 100,
    sodiumMg: 50,
    fluidMl: 0,
    weightG: 40,
  },
  {
    id: "drink-1",
    name: "Boisson orange",
    brandName: "Marque",
    divisibleBy: 1,
    formatLabel: "drink",
    carbsG: 45,
    energyKcal: 180,
    sodiumMg: 400,
    fluidMl: 500,
    weightG: 60,
  },
  {
    id: "drink-2",
    name: "Boisson menthe",
    brandName: "Marque",
    divisibleBy: 1,
    formatLabel: "drink",
    carbsG: 40,
    energyKcal: 160,
    sodiumMg: 300,
    fluidMl: 500,
    weightG: 55,
  },
];

function leg(patch: Partial<Leg>): Leg {
  return {
    rank: 1,
    endPositionM: 9800,
    endName: null,
    imposedDurationS: null,
    imposedCarbsGH: null,
    ascentM: 0,
    descentM: 0,
    durationS: 4500,
    stopS: null,
    elapsedS: 4500,
    servings: [],
    fills: [],
    opensLiquidSpan: true,
    supply: { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 },
    needG: 75,
    needFluidMl: 620,
    needSodiumMg: 372,
    marginG: 0,
    warnings: [],
    ...patch,
  };
}

/** Une course dont chaque ravito donne de l'eau : une portée par secteur. */
const SOLO = [leg({ rank: 1 }), leg({ rank: 2 })];

/** Le secteur 2 n'a pas d'eau à sa borne : sa portée couvre le 2 et le 3. */
const PORTEE_LONGUE = [
  leg({ rank: 1, opensLiquidSpan: true }),
  leg({ rank: 2, opensLiquidSpan: true }),
  leg({ rank: 3, opensLiquidSpan: false }),
];

/** Deux flasques de 500 mL, la contenance d'une dose de boisson chacune. */
const FLASQUES: Roadbook["flasks"] = [
  { rank: 1, volumeMl: 500, onlyWater: false },
  { rank: 2, volumeMl: 500, onlyWater: false },
];

function edit(patch: Partial<RoadbookEdit> = {}): RoadbookEdit {
  return { servings: [[], []], fills: [[], []], ...patch };
}

test("repasser une flasque à l'eau claire retire la boisson du secteur", () => {
  // Le bug d'origine : la ration survivait à sa flasque, et ses 500 mL se
  // comptaient en plus de l'eau claire versée à la place.
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 1 }], []],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 1, {
    productSnapshotId: null,
    volumeMl: 500,
  });

  expect(apres.servings[0]).toEqual([]);
  expect(apres.fills[0]).toEqual([
    { flaskRank: 1, productSnapshotId: null, volumeMl: 500 },
  ]);
});

test("vider la flasque retire aussi la boisson", () => {
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 1 }], []],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 1, null);

  expect(apres.servings[0]).toEqual([]);
  expect(apres.fills[0]).toEqual([]);
});

test("une seconde flasque qui verse la même boisson la retient", () => {
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 2 }], []],
    fills: [
      [
        { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
        { flaskRank: 2, productSnapshotId: "drink-1", volumeMl: 500 },
      ],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 1, {
    productSnapshotId: null,
    volumeMl: 500,
  });

  // Une flasque la verse encore : la ration reste, ramenée à cette flasque.
  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "drink-1", quantity: 1 },
  ]);
});

test("verser une boisson pose la ration que sa dose représente", () => {
  const avant = edit({
    fills: [[{ flaskRank: 1, productSnapshotId: null, volumeMl: 500 }], []],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 1, {
    productSnapshotId: "drink-1",
    volumeMl: 500,
  });

  // Sans cela, on portait 500 mL qui ne comptaient ni en glucides ni en
  // sodium : le noyau ne somme que les rations.
  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "drink-1", quantity: 1 },
  ]);
});

test("changer de boisson échange les rations", () => {
  const avant = edit({
    servings: [
      [
        { productSnapshotId: "gel-1", quantity: 2 },
        { productSnapshotId: "drink-1", quantity: 1 },
      ],
      [],
    ],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 1, {
    productSnapshotId: "drink-2",
    volumeMl: 500,
  });

  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "gel-1", quantity: 2 },
    { productSnapshotId: "drink-2", quantity: 1 },
  ]);
});

test("deux flasques de la même boisson valent deux doses", () => {
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 1 }], []],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 2, {
    productSnapshotId: "drink-1",
    volumeMl: 500,
  });

  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "drink-1", quantity: 2 },
  ]);
});

test("une ration retouchée sur place ne saute pas en bas de la carte", () => {
  const avant = edit({
    servings: [
      [
        { productSnapshotId: "drink-1", quantity: 1 },
        { productSnapshotId: "gel-1", quantity: 1 },
      ],
      [],
    ],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withFill(avant, SOLO, CATALOGUE, 0, 2, {
    productSnapshotId: "drink-1",
    volumeMl: 500,
  });

  expect(apres.servings[0].map((r) => r.productSnapshotId)).toEqual([
    "drink-1",
    "gel-1",
  ]);
});

test("une boisson que plus aucune flasque ne verse quitte toute la portée", () => {
  // La flasque est au secteur 2, la boisson se boit aussi au secteur 3 : la
  // retirer de la flasque doit la retirer des deux.
  const avant: RoadbookEdit = {
    servings: [
      [],
      [{ productSnapshotId: "drink-1", quantity: 1 }],
      [{ productSnapshotId: "drink-1", quantity: 1 }],
    ],
    fills: [
      [],
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  };

  const apres = withFill(avant, PORTEE_LONGUE, CATALOGUE, 1, 1, {
    productSnapshotId: null,
    volumeMl: 500,
  });

  expect(apres.servings[1]).toEqual([]);
  expect(apres.servings[2]).toEqual([]);
});

test("retirer la ration d'un secteur repasse sa flasque à l'eau claire", () => {
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 1 }], []],
    fills: [
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  });

  const apres = withServing(avant, SOLO, CATALOGUE, FLASQUES, 0, "drink-1", 0);

  expect(apres.servings[0]).toEqual([]);
  expect(apres.fills[0]).toEqual([
    { flaskRank: 1, productSnapshotId: null, volumeMl: 500 },
  ]);
});

test("la dose d'une boisson se retouche pour toute la portée, d'où qu'on la touche", () => {
  // Le noyau peut étaler une boisson sur les deux secteurs d'une portée. La
  // flasque, elle, est unique et à l'ouverture : retoucher la ration depuis
  // le secteur 3 dose donc la portée, et la ration retombe là où sont les
  // flasques.
  const avant: RoadbookEdit = {
    servings: [
      [],
      [{ productSnapshotId: "drink-1", quantity: 1 }],
      [{ productSnapshotId: "drink-1", quantity: 1 }],
    ],
    fills: [
      [],
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      [],
    ],
  };

  const deux = withServing(
    avant,
    PORTEE_LONGUE,
    CATALOGUE,
    FLASQUES,
    2,
    "drink-1",
    2,
  );

  expect(deux.servings[1]).toEqual([
    { productSnapshotId: "drink-1", quantity: 2 },
  ]);
  expect(deux.servings[2]).toEqual([]);
  expect(deux.fills[1]).toEqual([
    { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
    { flaskRank: 2, productSnapshotId: "drink-1", volumeMl: 500 },
  ]);
});

test("descendre une boisson d'une dose rend sa flasque à l'eau claire", () => {
  // Le trou que l'étape 4 laissait : la ration baissait, la flasque restait
  // versée, et l'on comptait 500 mL en portant 1 000.
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 2 }], []],
    fills: [
      [
        { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
        { flaskRank: 2, productSnapshotId: "drink-1", volumeMl: 500 },
      ],
      [],
    ],
  });

  const apres = withServing(avant, SOLO, CATALOGUE, FLASQUES, 0, "drink-1", 1);

  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "drink-1", quantity: 1 },
  ]);
  expect(apres.fills[0]).toEqual([
    { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
    { flaskRank: 2, productSnapshotId: null, volumeMl: 500 },
  ]);
});

test("une boisson ne dépasse pas ce que les flasques tiennent", () => {
  const avant = edit({
    servings: [[{ productSnapshotId: "drink-1", quantity: 2 }], []],
    fills: [
      [
        { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
        { flaskRank: 2, productSnapshotId: "drink-1", volumeMl: 500 },
      ],
      [],
    ],
  });

  // Trois doses réclament 1 500 mL pour 1 000 mL de flasques : la ration
  // retombe sur ce qui tient. Le stepper s'arrête avant, `flaskCapacityUnits`
  // le lui disant.
  const apres = withServing(avant, SOLO, CATALOGUE, FLASQUES, 0, "drink-1", 3);

  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "drink-1", quantity: 2 },
  ]);
  expect(flaskCapacityUnits(CATALOGUE[1], FLASQUES, apres.fills[0])).toBe(2);
});

test("une flasque « eau seulement » ne compte pas dans le plafond", () => {
  const flasques: Roadbook["flasks"] = [
    { rank: 1, volumeMl: 500, onlyWater: true },
    { rank: 2, volumeMl: 500, onlyWater: false },
  ];

  expect(flaskCapacityUnits(CATALOGUE[1], flasques, [])).toBe(1);
});

test("une flasque versée d'une autre boisson ne se fait pas voler", () => {
  const remplissages = [
    { flaskRank: 1, productSnapshotId: "drink-2", volumeMl: 500 },
    { flaskRank: 2, productSnapshotId: null, volumeMl: 500 },
  ];

  expect(flaskCapacityUnits(CATALOGUE[1], FLASQUES, remplissages)).toBe(1);
});

test("une boisson se retouche flasque par flasque, pas par demi-dose", () => {
  // `drink-1` se coupe en deux, mais une demi-dose n'irait dans aucune
  // flasque : le pas devient ce qu'une flasque représente.
  expect(servingStep({ ...CATALOGUE[1], divisibleBy: 2 }, FLASQUES)).toBe(1);
  expect(servingStep(CATALOGUE[0], FLASQUES)).toBe(1);
});

test("poser un solide ne touche à aucune flasque", () => {
  const avant = edit({
    fills: [[{ flaskRank: 1, productSnapshotId: null, volumeMl: 500 }], []],
  });

  const apres = withServing(avant, SOLO, CATALOGUE, FLASQUES, 0, "gel-1", 2);

  expect(apres.servings[0]).toEqual([
    { productSnapshotId: "gel-1", quantity: 2 },
  ]);
  expect(apres.fills).toEqual(avant.fills);
});
