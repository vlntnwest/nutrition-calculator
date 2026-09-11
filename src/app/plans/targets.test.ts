import { expect, test } from "vitest";
import { suggestedTargets } from "@/core/nutrition";
import type { Runner } from "@/core/type";
import { resolveTargets } from "./targets";

const RUNNER: Runner = { massKg: 70, flasks: [] };
const DUREE = 13500;

const VIDES = {
  targetCarbsGH: null,
  targetFluidMlH: null,
  targetSodiumMgL: null,
};

test("des cibles saisies passent telles quelles", () => {
  expect(
    resolveTargets(
      { targetCarbsGH: 90, targetFluidMlH: 700, targetSodiumMgL: 800 },
      RUNNER,
      DUREE,
    ),
  ).toEqual({ carbsGH: 90, fluidMlH: 700, sodiumMgL: 800 });
});

test("sans cible saisie, le noyau suggère", () => {
  expect(resolveTargets(VIDES, RUNNER, DUREE)).toEqual(
    suggestedTargets(RUNNER, DUREE),
  );
});

/**
 * Rien n'interdit à la base de ne porter qu'une partie des trois : la
 * suggestion vaut alors pour tout, et jamais moitié-moitié — un plan calculé
 * sur deux cibles saisies et une suggérée ne se relirait pas.
 */
test.each([
  ["les glucides seuls", { ...VIDES, targetCarbsGH: 90 }],
  ["la boisson seule", { ...VIDES, targetFluidMlH: 700 }],
  ["le sodium seul", { ...VIDES, targetSodiumMgL: 800 }],
  [
    "tout sauf les glucides",
    { ...VIDES, targetFluidMlH: 700, targetSodiumMgL: 800 },
  ],
  [
    "tout sauf la boisson",
    { ...VIDES, targetCarbsGH: 90, targetSodiumMgL: 800 },
  ],
  ["tout sauf le sodium", { ...VIDES, targetCarbsGH: 90, targetFluidMlH: 700 }],
])("%s ne suffit pas : tout vient de la suggestion", (_, stored) => {
  expect(resolveTargets(stored, RUNNER, DUREE)).toEqual(
    suggestedTargets(RUNNER, DUREE),
  );
});

test("zéro est une cible, pas une absence de cible", () => {
  expect(
    resolveTargets(
      { targetCarbsGH: 0, targetFluidMlH: 500, targetSodiumMgL: 600 },
      RUNNER,
      DUREE,
    ).carbsGH,
  ).toBe(0);
});
