import { expect, test } from "vitest";
import type { Roadbook } from "@/app/plans/getRoadbook";
import {
  bound,
  estVersable,
  excessive,
  legPaceSPerKm,
  startOf,
} from "./format";

type Leg = Roadbook["legs"][number];

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
