import { carryCapacityMl, drinkCapacityMl } from "./fill.ts";
import {
  CARBS_GUIDE_G_H,
  CARBS_OVERSHOOT_MAX,
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
} from "./guides.ts";
import { sum } from "./sum.ts";
import type { Leg, Product, Runner, Targets, Warning } from "./type.ts";

/**
 * Des remarques, jamais des interdits. La valeur saisie est toujours
 * respectée : l'outil dit ce qu'il en pense et laisse décider.
 *
 * Ce sont des **données**, pas des phrases — voir `Warning`.
 */
export function warnings(
  legs: Leg[],
  targets: Targets,
  products: Product[],
  runner: Runner,
  spans: number[][],
): Warning[] {
  const messages: Warning[] = [];

  if (products.filter((p) => p.carbsG > 0).length === 0) {
    messages.push({ code: "no-carb-product" });

    return messages;
  }

  if (targets.carbsGH > CARBS_GUIDE_G_H) {
    messages.push({
      code: "carbs-above-guide",
      carbsGH: targets.carbsGH,
      guideGH: CARBS_GUIDE_G_H,
    });
  }

  // Le point le plus utile du lot : viser haut avec des produits mono-source
  // est arithmétiquement satisfait et physiologiquement impossible.
  const supplied = sum(legs, (s) => s.supply.carbsG);
  const multi = sum(legs, (s) =>
    sum(
      s.servings.filter((r) => r.product.multiTransportable),
      (r) => r.units * r.product.carbsG,
    ),
  );

  if (
    targets.carbsGH > CARBS_SINGLE_SOURCE_MAX_G_H &&
    multi < supplied * 0.8 &&
    supplied > 0
  ) {
    messages.push({
      code: "carbs-single-source",
      carbsGH: targets.carbsGH,
      maxGH: CARBS_SINGLE_SOURCE_MAX_G_H,
      multiShare: multi / supplied,
    });
  }

  const carbNeed = sum(legs, (s) => s.need.carbsG);
  if (carbNeed > 0 && supplied > carbNeed * CARBS_OVERSHOOT_MAX) {
    messages.push({
      code: "carbs-above-target",
      share: supplied / carbNeed,
    });
  }

  if (targets.fluidMlH > FLUID_GUIDE_ML_H) {
    messages.push({
      code: "fluid-above-guide",
      fluidMlH: targets.fluidMlH,
      guideMlH: FLUID_GUIDE_ML_H,
    });
  }

  const sodiumNeed = sum(legs, (s) => s.need.sodiumMg);
  const sodiumSupply = sum(legs, (s) => s.supply.sodiumMg);
  if (sodiumNeed > 0 && sodiumSupply < sodiumNeed * 0.7) {
    messages.push({
      code: "sodium-below-target",
      share: sodiumSupply / sodiumNeed,
    });
  }

  // Le sodium suit la boisson qui dose les glucides : rien ne l'ajuste à
  // part, et sa concentration réelle n'a pas de raison de tomber juste sur
  // la cible visée à côté. Même seuil de tolérance que `carbs-above-target`.
  if (sodiumNeed > 0 && sodiumSupply > sodiumNeed * CARBS_OVERSHOOT_MAX) {
    messages.push({
      code: "sodium-above-target",
      share: sodiumSupply / sodiumNeed,
    });
  }

  const carryMl = carryCapacityMl(runner);

  for (const [legIndex, s] of legs.entries()) {
    if (s.durationS > 0 && s.supply.fluidMl > s.need.fluidMl) {
      messages.push({
        code: "leg-fluid-above-target",
        legIndex,
        supplyMl: s.supply.fluidMl,
        needMl: s.need.fluidMl,
      });
    }
  }

  // Le portage se juge sur la **portée** : entre deux points d'eau, une seule
  // contenance doit couvrir tous les secteurs franchis. Secteur par secteur,
  // un ravito sans eau passait inaperçu.
  const drinkCap = drinkCapacityMl(runner);
  for (const span of spans) {
    const legIndex = span[0];
    const throughLegIndex = span[span.length - 1];

    // Ce qu'il faut réellement porter : le plus contraignant de ce qu'on doit
    // boire et de ce que la boisson préparée occupe.
    const requiredMl = span.reduce(
      (t, l) => t + Math.max(legs[l].need.fluidMl, legs[l].supply.fluidMl),
      0,
    );
    if (carryMl !== null && requiredMl > carryMl) {
      messages.push({
        code: "leg-fluid-above-carry",
        legIndex,
        throughLegIndex,
        requiredMl,
        carryMl,
      });
    }

    // La boisson préparée ne tient pas dans les flasques qui l'acceptent. Sans
    // ça, la ventilation laisserait le surplus disparaître de la liste.
    const drinkMl = span.reduce((t, l) => t + legs[l].supply.fluidMl, 0);
    if (drinkCap !== null && drinkMl > drinkCap) {
      messages.push({
        code: "leg-drink-above-flasks",
        legIndex,
        throughLegIndex,
        drinkMl,
        capacityMl: drinkCap,
      });
    }
  }

  return messages;
}
