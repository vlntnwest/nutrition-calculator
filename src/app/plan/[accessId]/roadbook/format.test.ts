import { expect, test } from "vitest";
import type { Roadbook } from "@/app/plans/getRoadbook";
import {
  bound,
  estVersable,
  excessive,
  legPaceBand,
  legPaceSPerKm,
  liveCarriedMl,
  liveSupply,
  liveTotal,
  pouredUnits,
  spanFluidNeedMl,
  spanIndexes,
  spanStart,
  startOf,
} from "./format";

type Leg = Roadbook["legs"][number];
type Catalogue = Roadbook["catalogue"];

const CATALOGUE: Catalogue = [
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
    divisibleBy: 2,
    formatLabel: "drink",
    carbsG: 45,
    energyKcal: 180,
    sodiumMg: 400,
    fluidMl: 500,
    weightG: 60,
  },
];

function leg(patch: Partial<Leg>): Leg {
  return {
    rank: 1,
    endPositionM: 9800,
    endName: null,
    imposedDurationS: null,
    imposedCarbsGH: null,
    ascentM: 420,
    descentM: 180,
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

test("le dernier secteur se nomme par l'arrivée, pas par une borne", () => {
  expect(bound(leg({ endPositionM: null }), 28400)).toBe("arrivée, 28,4 km");
  expect(bound(leg({}), 28400)).toBe("9,8 km");
});

test("un secteur commence là où le précédent s'achève", () => {
  const legs = [leg({ rank: 1 }), leg({ rank: 2, endPositionM: 19200 })];

  expect(startOf(legs, 0)).toBe(0);
  expect(startOf(legs, 1)).toBe(9800);
});

test("l'allure d'un secteur se compte sur sa propre distance", () => {
  const legs = [leg({ durationS: 4500 })];

  // 9,8 km en 4 500 s : 459,2 s/km.
  expect(legPaceSPerKm(legs, 0, 28400)).toBeCloseTo(459.18, 1);
});

test("un secteur sans durée ne rend pas d'allure", () => {
  expect(legPaceSPerKm([leg({ durationS: 0 })], 0, 28400)).toBeNull();
});

test("la bande d'allure du roadbook reprend la forme de celle de Course", () => {
  const legs = [
    leg({ rank: 1, endPositionM: 10000, durationS: 3600 }),
    leg({ rank: 2, endPositionM: null, durationS: 5400 }),
  ];

  const bande = legPaceBand(legs, 28400);

  expect(bande?.segments[0]).toEqual({ startM: 0, endM: 10000, sPerKm: 360 });
  expect(bande?.segments[1].startM).toBe(10000);
  expect(bande?.segments[1].endM).toBe(28400);
  expect(bande?.segments[1].sPerKm).toBeCloseTo(293.478, 2);
  expect(bande?.meanSPerKm).toBeCloseTo((3600 + 5400) / (28400 / 1000), 6);
  expect(bande?.slowestSPerKm).toBe(360);
  expect(bande?.fastestSPerKm).toBeCloseTo(293.478, 2);
});

test("sans aucune allure lisible, la bande est nulle", () => {
  expect(legPaceBand([leg({ durationS: 0 })], 28400)).toBeNull();
});

test("seul un dépassement franc du besoin se signale", () => {
  expect(excessive(80, 75)).toBe(false);
  expect(excessive(110, 75)).toBe(true);
  expect(excessive(50, 0)).toBe(false);
});

test("une flasque ne prend que ce qui se dilue", () => {
  expect(estVersable("drink")).toBe(true);
  expect(estVersable("bar")).toBe(false);
  expect(estVersable("gel")).toBe(false);
  expect(estVersable("capsule")).toBe(false);
});

test("l'apport d'un secteur se recalcule sur ses retouches, sans attendre l'enregistrement", () => {
  const supply = liveSupply(
    [
      { productSnapshotId: "gel-1", quantity: 2 },
      { productSnapshotId: "drink-1", quantity: 1 },
    ],
    CATALOGUE,
  );

  expect(supply).toEqual({
    carbsG: 95,
    energyKcal: 380,
    sodiumMg: 500,
    fluidMl: 500,
  });
});

test("un produit disparu du catalogue ne compte pour rien", () => {
  expect(
    liveSupply([{ productSnapshotId: "inconnu", quantity: 3 }], CATALOGUE),
  ).toEqual({ carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 });
});

test("une boisson dosée ne s'ajoute pas à l'eau claire des flasques", () => {
  // Le secteur 1 d'un plan réel : deux flasques d'eau claire et une ration
  // de boisson restée là. On porte 1 000 mL, pas 1 500 — un millilitre
  // d'eau reste un millilitre, mélangé ou non.
  expect(
    liveCarriedMl([
      { flaskRank: 1, productSnapshotId: null, volumeMl: 500 },
      { flaskRank: 2, productSnapshotId: null, volumeMl: 500 },
    ]),
  ).toBe(1000);
});

test("une flasque versée de boisson porte son volume, comme une autre", () => {
  expect(
    liveCarriedMl([
      { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
    ]),
  ).toBe(500);
});

test("un secteur au milieu d'une portée ne porte rien", () => {
  // `remplissages` n'existe qu'à l'ouverture d'une portée (voir `editOf`) :
  // ailleurs, les flasques ont été préparées en amont.
  expect(liveCarriedMl([])).toBe(0);
});

test("le besoin d'une portée cumule les secteurs jusqu'au prochain remplissage", () => {
  // Un ravito qui ne donne pas d'eau au bout du secteur 2 : les flasques
  // remplies en l'ouvrant doivent tenir jusqu'à la fin du secteur 3.
  const legs = [
    leg({ rank: 1, needFluidMl: 706, opensLiquidSpan: true }),
    leg({ rank: 2, needFluidMl: 1239, opensLiquidSpan: true }),
    leg({ rank: 3, needFluidMl: 1103, opensLiquidSpan: false }),
    leg({ rank: 4, needFluidMl: 800, opensLiquidSpan: true }),
  ];

  expect(spanFluidNeedMl(legs, 0)).toBe(706);
  expect(spanFluidNeedMl(legs, 1)).toBe(1239 + 1103);
  expect(spanFluidNeedMl(legs, 3)).toBe(800);
});

test("la portée du dernier secteur s'arrête à l'arrivée", () => {
  const legs = [
    leg({ rank: 1, needFluidMl: 706, opensLiquidSpan: true }),
    leg({ rank: 2, needFluidMl: 1239, opensLiquidSpan: false }),
  ];

  expect(spanFluidNeedMl(legs, 0)).toBe(706 + 1239);
});

test("une portée couvre les secteurs qui ne rouvrent pas", () => {
  const legs = [
    leg({ rank: 1, opensLiquidSpan: true }),
    leg({ rank: 2, opensLiquidSpan: true }),
    leg({ rank: 3, opensLiquidSpan: false }),
    leg({ rank: 4, opensLiquidSpan: false }),
    leg({ rank: 5, opensLiquidSpan: true }),
  ];

  expect(spanIndexes(legs, 0)).toEqual([0]);
  expect(spanIndexes(legs, 1)).toEqual([1, 2, 3]);
  expect(spanIndexes(legs, 4)).toEqual([4]);
});

test("un secteur sans flasque renvoie à l'ouverture de sa portée", () => {
  const legs = [
    leg({ rank: 1, opensLiquidSpan: true }),
    leg({ rank: 2, opensLiquidSpan: true }),
    leg({ rank: 3, opensLiquidSpan: false }),
    leg({ rank: 4, opensLiquidSpan: false }),
  ];

  expect(spanStart(legs, 0)).toBe(0);
  expect(spanStart(legs, 1)).toBe(1);
  expect(spanStart(legs, 3)).toBe(1);
});

test("la dose versée suit le volume des flasques qui la portent", () => {
  // Une dose de boisson fait 500 mL : une flasque de 500 en vaut une, deux
  // en valent deux. L'eau claire posée à côté ne compte pas.
  expect(
    pouredUnits(
      "drink-1",
      [
        { flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 },
        { flaskRank: 2, productSnapshotId: "drink-1", volumeMl: 500 },
        { flaskRank: 3, productSnapshotId: null, volumeMl: 500 },
      ],
      CATALOGUE,
    ),
  ).toBe(2);

  expect(
    pouredUnits(
      "drink-1",
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
      CATALOGUE,
    ),
  ).toBe(1);
});

test("une dose sécable s'arrondit au demi", () => {
  // Une flasque de 750 mL pour une dose de 500 : une dose et demie, que le
  // stepper sait poser puisque le produit se coupe en deux.
  expect(
    pouredUnits(
      "drink-2",
      [{ flaskRank: 1, productSnapshotId: "drink-2", volumeMl: 750 }],
      CATALOGUE,
    ),
  ).toBe(1.5);
});

test("une flasque plus petite qu'une dose vaut au moins un pas", () => {
  // 150 mL pour une dose de 500 : le rapport arrondirait à zéro, et la base
  // refuse une ration nulle.
  expect(
    pouredUnits(
      "drink-1",
      [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 150 }],
      CATALOGUE,
    ),
  ).toBe(1);
});

test("le sac complet somme les retouches de tous les secteurs", () => {
  const total = liveTotal(
    [
      [{ productSnapshotId: "gel-1", quantity: 2 }],
      [{ productSnapshotId: "drink-1", quantity: 1 }],
    ],
    [50, 90],
    CATALOGUE,
  );

  expect(total).toEqual({
    carbsG: 95,
    energyKcal: 380,
    sodiumMg: 500,
    fluidMl: 500,
    marginG: 95 - 140,
    weightG: 140,
    units: [
      { name: "Gel citron", brandName: "Marque", quantity: 2 },
      { name: "Boisson orange", brandName: "Marque", quantity: 1 },
    ],
  });
});
