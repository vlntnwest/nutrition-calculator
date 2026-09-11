import { carrySpans, splitByAidStation } from "./legs.ts";
import { provision } from "./provision.ts";
import { sum } from "./sum.ts";
import type {
  AidStation,
  Imposed,
  NutritionPlan,
  Product,
  Runner,
  Targets,
  TimedPoint,
} from "./type.ts";
import { warnings } from "./warnings.ts";

/**
 * Un point de départ pour les cibles. Ce sont des **suggestions** : rien
 * n'empêche l'utilisateur de saisir autre chose.
 *
 * Les glucides ne dépendent pas de la masse corporelle — l'oxydation des
 * glucides venus de l'extérieur est limitée par l'absorption intestinale, pas
 * par le gabarit. L'hydratation et le sodium, si.
 */
export function suggestedTargets(runner: Runner, durationS: number): Targets {
  const hours = durationS / 3600;

  let carbsGH = 60;
  if (hours < 1) carbsGH = 0;
  else if (hours < 2) carbsGH = 30;

  return {
    carbsGH,
    fluidMlH: 7 * runner.massKg,
    sodiumMgL: 600,
  };
}

/**
 * Le plan complet — ce qu'on emporte, pas quand on mange. ADR 007.
 *
 * Le débit de glucides est **constant** : un secteur de montagne ne reçoit pas
 * plus par heure qu'un secteur roulant, il reçoit plus parce qu'il dure plus
 * longtemps.
 *
 * @param parts Part des glucides confiée à chaque produit. Par défaut, à
 *   parts égales.
 */
export function nutritionPlan(
  points: TimedPoint[],
  aidStations: AidStation[],
  runner: Runner,
  targets: Targets,
  products: Product[],
  /**
   * `parts` : la part de chaque produit. `finishTargets` : les cibles du
   * dernier secteur, qu'aucun ravito ne clôt et qui se règle donc à part.
   */
  options:
    | number[]
    | {
        parts?: number[];
        finishTargets?: Partial<Targets>;
        imposed?: Imposed;
      } = {},
): NutritionPlan {
  const { parts, finishTargets, imposed } = Array.isArray(options)
    ? { parts: options, finishTargets: undefined, imposed: undefined }
    : options;
  const raws = splitByAidStation(points, aidStations, runner);
  const endM = points.length > 0 ? points[points.length - 1].d : 0;
  const spans = {
    liquid: carrySpans(aidStations, endM, raws.length, (a) => a.providesLiquid),
    solid: carrySpans(aidStations, endM, raws.length, (a) => a.providesSolid),
  };
  const legs = provision(
    raws,
    aidStations,
    targets,
    products,
    runner,
    spans.liquid,
    parts,
    finishTargets,
    imposed,
  );

  const units = new Map<string, number>();
  for (const s of legs) {
    for (const r of s.servings) {
      units.set(r.product.id, (units.get(r.product.id) ?? 0) + r.units);
    }
  }

  const carbsG = sum(legs, (s) => s.supply.carbsG);
  const durationS = sum(legs, (s) => s.durationS);
  const stopS = sum(legs, (s) => s.stopS);
  const total = {
    durationS,
    stopS,
    elapsedS: durationS + stopS,
    expenditureKcal: sum(legs, (s) => s.expenditureKcal),
    carbsG,
    energyKcal: sum(legs, (s) => s.supply.energyKcal),
    sodiumMg: sum(legs, (s) => s.supply.sodiumMg),
    fluidMl: sum(legs, (s) => s.supply.fluidMl),
    marginG: carbsG - sum(legs, (s) => s.need.carbsG),
    units,
  };

  return {
    legs,
    spans,
    total,
    warnings: warnings(legs, targets, products, runner, spans.liquid),
  };
}
