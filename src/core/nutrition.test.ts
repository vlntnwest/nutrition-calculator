import { expect, test } from "vitest";
import { SAMPLE_PRODUCTS } from "@/fixtures/sampleProducts";
import { drink, flatTrack, gel, RUNNER, TARGETS } from "./fixtures/plan";
import { FLUID_GUIDE_ML_H } from "./guides";
import { nutritionPlan, suggestedTargets } from "./nutrition";

test("le jeu d'essai est cohérent", () => {
  expect(new Set(SAMPLE_PRODUCTS.map((p) => p.id)).size).toBe(
    SAMPLE_PRODUCTS.length,
  );

  for (const p of SAMPLE_PRODUCTS) {
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
  expect(plan.warnings).toContainEqual({
    code: "carbs-above-guide",
    carbsGH: 120,
    guideGH: 90,
  });
  expect(plan.warnings).toContainEqual({
    code: "fluid-above-guide",
    fluidMlH: 1400,
    guideMlH: 800,
  });
  expect(FLUID_GUIDE_ML_H).toBe(800);
});

test("les glucides ignorent la masse, l'hydratation non", () => {
  const light = suggestedTargets({ massKg: 55, flasks: [] }, 4 * 3600);
  const heavy = suggestedTargets({ massKg: 95, flasks: [] }, 4 * 3600);

  expect(light.carbsGH).toBe(heavy.carbsGH);
  expect(heavy.fluidMlH).toBeGreaterThan(light.fluidMlH);
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
    expect(units).toBeCloseTo(perLeg, 9);
  }
  expect(plan.total.durationS).toBeCloseTo(8 * 3600, 6);
});

test("l'énergie apportée est comptée, et n'est pas la dépense", () => {
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [gel]);
  const units = plan.legs[0].servings[0].units;

  expect(plan.total.energyKcal).toBeCloseTo(units * gel.energyKcal, 6);
  // On ne mange jamais sa dépense : le reste vient des graisses.
  expect(plan.total.energyKcal).toBeLessThan(plan.total.expenditureKcal);
});
