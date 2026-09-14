import type { Roadbook } from "@/app/plans/roadbook";

type Leg = Roadbook["legs"][number];

/**
 * Le catalogue d'un plan d'essai : un solide, et deux boissons dont l'une se
 * coupe en deux. De quoi exercer le versable, le sécable et le reste.
 */
export const CATALOGUE: Roadbook["catalogue"] = [
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

/** Deux flasques de 500 mL, la contenance d'une dose de boisson chacune. */
export const FLASQUES: Roadbook["flasks"] = [
  { rank: 1, volumeMl: 500, onlyWater: false },
  { rank: 2, volumeMl: 500, onlyWater: false },
];

export function leg(patch: Partial<Leg> = {}): Leg {
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
    opensSolidSpan: true,
    supply: { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 },
    needG: 75,
    needFluidMl: 620,
    needSodiumMg: 372,
    marginG: 0,
    warnings: [],
    ...patch,
  };
}

/** Un plan calculé, dont les secteurs se remplacent au besoin. */
export function roadbook(patch: Partial<Roadbook> = {}): Roadbook {
  return {
    legs: [leg()],
    startTime: null,
    catalogue: CATALOGUE,
    flasks: FLASQUES,
    edited: false,
    generatedAt: new Date("2026-09-10T08:00:00Z"),
    totalM: 28400,
    total: {
      carbsG: 0,
      energyKcal: 0,
      sodiumMg: 0,
      fluidMl: 0,
      marginG: 0,
      weightG: 0,
      units: [],
    },
    warnings: [],
    ...patch,
  };
}
