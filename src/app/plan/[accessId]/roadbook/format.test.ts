import { expect, test } from "vitest";
import type { Roadbook } from "@/app/plans/getRoadbook";
import {
  bound,
  estVersable,
  excessive,
  legPaceBand,
  legPaceSPerKm,
  liveFluidCoverage,
  liveSupply,
  liveTotal,
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

test("l'eau claire versée dans les flasques s'ajoute à la boisson dosée", () => {
  // Reproduit un secteur réel : 954 mL de besoin, une dose de boisson
  // (500 mL) posée en ration, et deux flasques d'eau claire (500 mL
  // chacune) — 1 000 mL réellement portés, pas 500.
  const eau = liveFluidCoverage(
    [{ productSnapshotId: "drink-1", quantity: 1 }],
    [
      { flaskRank: 1, productSnapshotId: null, volumeMl: 500 },
      { flaskRank: 2, productSnapshotId: null, volumeMl: 500 },
    ],
    CATALOGUE,
  );

  expect(eau).toBe(1500);
});

test("sans remplissage déclaré, seule la boisson dosée compte", () => {
  // Le cas d'un secteur qui ne rouvre pas de portée : `remplissages` est
  // vide (voir `editOf`), et la couverture retombe sur `liveSupply` seul.
  const eau = liveFluidCoverage(
    [{ productSnapshotId: "drink-1", quantity: 1 }],
    [],
    CATALOGUE,
  );

  expect(eau).toBe(500);
});

test("une flasque remplie de la boisson elle-même ne se recompte pas deux fois", () => {
  // La ration dit déjà combien de boisson est bue ; le remplissage ne fait
  // que déclarer où elle va physiquement. Seule l'eau claire (produit nul)
  // ajoute une couverture que les rations ne portaient pas encore.
  const eau = liveFluidCoverage(
    [{ productSnapshotId: "drink-1", quantity: 1 }],
    [{ flaskRank: 1, productSnapshotId: "drink-1", volumeMl: 500 }],
    CATALOGUE,
  );

  expect(eau).toBe(500);
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
