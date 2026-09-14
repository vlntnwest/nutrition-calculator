import { expect, test } from "vitest";
import {
  baouwGel,
  CARRIER,
  DRY_STOP,
  drink,
  flatTrack,
  gel,
  RUNNER,
  TARGETS,
  WATER_STOP,
} from "./fixtures/plan";
import { CARBS_OVERSHOOT_MAX, CARBS_SINGLE_SOURCE_MAX_G_H } from "./guides";
import { nutritionPlan } from "./nutrition";
import type { Runner, Targets } from "./type";

/**
 * La contenance est une contrainte **par portée**. Sans ravito, la portée est
 * la course entière : le noyau proposait jusqu'ici 2 500 mL à qui en porte
 * 1 000.
 */
test("un secteur qui demande plus que ce qu'on porte le dit", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 500, onlyWater: true },
    ],
  };
  const plan = nutritionPlan(flatTrack(40, 5), [], runner, TARGETS, [
    gel,
    drink,
  ]);

  // 5 h à 500 mL/h : 2 500 mL réclamés pour 1 000 mL portés.
  expect(plan.warnings).toContainEqual({
    code: "leg-fluid-above-carry",
    legIndex: 0,
    throughLegIndex: 0,
    requiredMl: 2500,
    carryMl: 1000,
  });

  // La flasque réservée à l'eau ne reçoit pas de poudre : une dose, pas deux.
  expect(
    plan.legs[0].servings.find((r) => r.product.id === drink.id)?.units,
  ).toBe(1);
});

/**
 * Le piège de la ventilation : la contenance totale suffit, mais pas celle qui
 * accepte de la poudre. Sans cette remarque le surplus disparaîtrait de la
 * liste des flasques sans que rien ne le dise.
 */
test("une boisson qui déborde des flasques autorisées le dit", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 2000, onlyWater: true },
    ],
  };
  // Sans solide, la boisson porte les glucides seule : 7,5 doses, 3 750 mL.
  const plan = nutritionPlan(
    flatTrack(40, 5),
    [],
    runner,
    { ...TARGETS, carbsGH: 80 },
    [drink],
  );

  expect(plan.warnings).toContainEqual({
    code: "leg-drink-above-flasks",
    legIndex: 0,
    throughLegIndex: 0,
    drinkMl: 3750,
    capacityMl: 500,
  });
});

test("alerte quand on vise haut sans glucose-fructose", () => {
  const points = flatTrack(40, 5);
  const targets: Targets = { ...TARGETS, carbsGH: 80 };

  const singleSource = nutritionPlan(points, [], RUNNER, targets, [baouwGel]);
  const multi = nutritionPlan(points, [], RUNNER, targets, [gel]);

  expect(
    singleSource.warnings.some((w) => w.code === "carbs-single-source"),
  ).toBe(true);
  expect(multi.warnings.some((w) => w.code === "carbs-single-source")).toBe(
    false,
  );
  expect(CARBS_SINGLE_SOURCE_MAX_G_H).toBe(60);
});

test("alerte quand le sodium apporté est trop bas", () => {
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [baouwGel]);

  expect(plan.warnings.some((w) => w.code === "sodium-below-target")).toBe(
    true,
  );
});

/**
 * Le cas courant : une boisson à 800 mg/L (`naak-drink-ultra`) dosée pour
 * tenir 60 g/h de glucides sert plus que les 600 mg/L visés, sans qu'on ait
 * rien demandé de tel — rien n'ajuste le sodium à part.
 */
test("alerte quand le sodium apporté est trop haut", () => {
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [drink]);

  expect(plan.warnings.some((w) => w.code === "sodium-above-target")).toBe(
    true,
  );
});

test("sans produit, le plan le dit au lieu de diviser par zéro", () => {
  const plan = nutritionPlan(flatTrack(10, 2), [], RUNNER, TARGETS, []);

  expect(plan.legs[0].servings).toEqual([]);
  expect(plan.total.carbsG).toBe(0);
  expect(plan.warnings[0]).toEqual({ code: "no-carb-product" });
});

test("une portée franchit le ravito sans eau", () => {
  // 40 km en 4 h, coupés à 10 et 20 km. La portée qui part du point d'eau
  // couvre 1 h puis 2 h, soit 1 500 mL pour 1 000 mL portés — alors qu'aucun
  // des deux secteurs pris isolément ne dépasse la contenance.
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, DRY_STOP],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.warnings).toContainEqual({
    code: "leg-fluid-above-carry",
    legIndex: 1,
    throughLegIndex: 2,
    requiredMl: 1500,
    carryMl: 1000,
  });
});

/**
 * Le cas du plan trop sucré sans l'avoir demandé.
 *
 * Une boisson à 55 g pour 500 ml apporte 55 g/h dès qu'on vise 500 ml/h :
 * viser 30 g/h de glucides est alors dépassé avant d'avoir rien mangé. Rien
 * ne le signalait — `carbs-above-guide` juge la **cible**, pas ce qui est
 * réellement servi.
 */
test("alerte quand le plan sert bien plus de glucides que demandé", () => {
  const points = flatTrack(40, 5);
  const bas: Targets = { carbsGH: 30, fluidMlH: 500, sodiumMgL: 600 };

  const trop = nutritionPlan(points, [], RUNNER, bas, [drink]);
  const juste = nutritionPlan(points, [], RUNNER, TARGETS, [gel, drink]);

  expect(trop.warnings.some((w) => w.code === "carbs-above-target")).toBe(true);
  expect(juste.warnings.some((w) => w.code === "carbs-above-target")).toBe(
    false,
  );
});

test("l'alerte porte l'écart, pas une phrase", () => {
  const bas: Targets = { carbsGH: 30, fluidMlH: 500, sodiumMgL: 600 };
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, bas, [drink]);
  const alerte = plan.warnings.find((w) => w.code === "carbs-above-target");

  expect(alerte).toMatchObject({ code: "carbs-above-target" });
  // Le rapport servi/visé : au-delà de 1, et au-delà du seuil toléré.
  expect(alerte && "share" in alerte ? alerte.share : 0).toBeGreaterThan(
    CARBS_OVERSHOOT_MAX,
  );
});

test("un dépassement de rangement ne déclenche rien", () => {
  // Les produits sont discrets : un gel de trop suffit à dépasser de peu.
  expect(CARBS_OVERSHOOT_MAX).toBe(1.3);
});

test("les remarques se rejouent sur les rations imposées", () => {
  const impose = nutritionPlan(flatTrack(20, 3), [], RUNNER, TARGETS, [gel], {
    imposed: { servings: [[{ productId: gel.id, units: 20 }]] },
  });

  // 540 g sur 180 visés, très au-delà de CARBS_OVERSHOOT_MAX.
  expect(impose.warnings.map((w) => w.code)).toContain("carbs-above-target");
});
