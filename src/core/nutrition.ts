import { energyCost } from "./pace.ts";
import type {
  AidStation,
  Leg,
  NutritionPlan,
  Product,
  RawLeg,
  Runner,
  Serving,
  Targets,
  TimedPoint,
  Warning,
} from "./type.ts";

const JOULES_PER_KCAL = 4184;

/** Paliers proposés dans l'interface. Aucune valeur n'est imposée. */
export const CARB_TIERS = [30, 60, 90];

/** Au-delà, le glucose seul sature son transporteur intestinal. */
export const CARBS_SINGLE_SOURCE_MAX_G_H = 60;

/** Repère de tolérance digestive au-delà duquel on alerte, sans interdire. */
export const CARBS_GUIDE_G_H = 90;

/**
 * Repère d'hydratation. Boire plus qu'on ne transpire dilue le sodium sanguin
 * — c'est l'hyponatrémie d'effort. On alerte, on n'écrête pas : changer une
 * valeur saisie sans le dire est pire que de ne rien faire.
 */
export const FLUID_GUIDE_ML_H = 800;

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

/** Le temps cumulé à une distance donnée, par interpolation linéaire sur `d`. */
export function timeAt(points: TimedPoint[], distanceM: number): number {
  if (points.length === 0) return 0;

  let i = 1;
  while (i < points.length - 1 && points[i].d < distanceM) i++;

  const a = points[i - 1];
  const b = points[i];
  if (b.d === a.d) return a.t;

  return a.t + ((distanceM - a.d) / (b.d - a.d)) * (b.t - a.t);
}

/**
 * Le plan complet, secteur par secteur.
 *
 * Chaque secteur est traité **séparément** : c'est ce qu'on charge dans le sac
 * à un ravito pour tenir jusqu'au suivant. Arrondir par secteur n'est pas une
 * approximation, c'est la réalité — on n'emporte pas un tiers de gel.
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
  parts?: number[],
): NutritionPlan {
  const legs = splitByAidStation(points, aidStations, runner).map((raw) =>
    provision(raw, targets, products, parts),
  );

  const units = new Map<string, number>();
  for (const s of legs) {
    for (const r of s.servings) {
      units.set(r.product.id, (units.get(r.product.id) ?? 0) + r.units);
    }
  }

  const total = {
    durationS: sum(legs, (s) => s.durationS),
    expenditureKcal: sum(legs, (s) => s.expenditureKcal),
    carbsG: sum(legs, (s) => s.supply.carbsG),
    sodiumMg: sum(legs, (s) => s.supply.sodiumMg),
    fluidMl: sum(legs, (s) => s.supply.fluidMl),
    units,
  };

  return { legs, total, warnings: warnings(legs, targets, products) };
}

function sum<T>(items: T[], read: (item: T) => number): number {
  return items.reduce((s, item) => s + read(item), 0);
}

/**
 * Découpe la trace aux ravitos. Le premier secteur part du départ, le dernier
 * arrive à l'arrivée : un roadbook sans ravito donne donc un secteur unique.
 */
export function splitByAidStation(
  points: TimedPoint[],
  aidStations: AidStation[],
  runner: Runner,
): RawLeg[] {
  if (points.length < 2) return [];

  const endM = points[points.length - 1].d;
  const bounds = [...aidStations]
    .filter((r) => r.distanceM > 0 && r.distanceM < endM)
    .sort((a, b) => a.distanceM - b.distanceM);

  const legs: RawLeg[] = [];
  let startM = 0;
  // `null` aux deux bouts : « Départ » et « Arrivée » sont des mots, donc
  // l'affaire de l'affichage. Le nom d'un ravito, lui, vient du roadbook.
  let from: string | null = null;
  let i = 1;

  for (const [k, ravito] of [...bounds, null].entries()) {
    const boundM = ravito?.distanceM ?? endM;
    const to = ravito?.name ?? null;

    let ascentM = 0;
    let descentM = 0;
    let joules = 0;

    // Curseur qui n'avance jamais en arrière : la boucle reste linéaire sur
    // l'ensemble des secteurs.
    while (i < points.length && points[i].d <= boundM) {
      const length = points[i].d - points[i - 1].d;
      if (length > 0) {
        const delta = points[i].ele - points[i - 1].ele;
        if (delta > 0) ascentM += delta;
        else descentM -= delta;
        joules += energyCost(delta / length) * length;
      }
      i++;
    }

    const startS = timeAt(points, startM);
    const arrivalS = timeAt(points, boundM);

    legs.push({
      from,
      to,
      startM,
      endM: boundM,
      lengthM: boundM - startM,
      ascentM,
      descentM,
      startS,
      arrivalS,
      durationS: arrivalS - startS,
      expenditureKcal: (joules * runner.massKg) / JOULES_PER_KCAL,
    });

    startM = boundM;
    from = to;
    if (k === bounds.length) break;
  }

  return legs;
}

function provision(
  raw: RawLeg,
  targets: Targets,
  products: Product[],
  parts?: number[],
): Leg {
  const hours = raw.durationS / 3600;
  const fluidMl = targets.fluidMlH * hours;
  const need = {
    carbsG: targets.carbsGH * hours,
    fluidMl,
    sodiumMg: (fluidMl / 1000) * targets.sodiumMgL,
  };

  // La part est lue sur la position d'origine, avant le filtrage : sinon un
  // produit sans glucides décale en silence toutes les parts qui le suivent.
  const kept = products
    .map((product, i) => ({ product, weight: parts?.[i] ?? 1 }))
    .filter(({ product }) => product.carbsG > 0);
  const usable = kept.map((k) => k.product);
  const weights = kept.map((k) => k.weight);
  const totalWeight = weights.reduce((s, p) => s + p, 0);
  const ideal = usable.map((_, i) => (need.carbsG * weights[i]) / totalWeight);

  // Arrondir au supérieur produit par produit cumulerait les excès. On part du
  // plancher et on ne rajoute que le nécessaire, en servant à chaque tour
  // celui qui est le plus loin de sa part.
  const units = usable.map((p, i) => Math.floor(ideal[i] / p.carbsG));
  const supplied = () => usable.reduce((s, p, i) => s + units[i] * p.carbsG, 0);

  while (usable.length > 0 && supplied() < need.carbsG) {
    let chosen = 0;
    let worst = -Infinity;
    for (let i = 0; i < usable.length; i++) {
      const gap = ideal[i] - units[i] * usable[i].carbsG;
      if (gap > worst) {
        worst = gap;
        chosen = i;
      }
    }
    units[chosen]++;
  }

  const servings: Serving[] = usable
    .map((product, i) => ({
      product,
      units: units[i],
      intervalS: units[i] > 0 ? raw.durationS / units[i] : 0,
    }))
    .filter((r) => r.units > 0);

  const supply = servings.reduce(
    (s, r) => ({
      carbsG: s.carbsG + r.units * r.product.carbsG,
      sodiumMg: s.sodiumMg + r.units * r.product.sodiumMg,
      fluidMl: s.fluidMl + r.units * r.product.fluidMl,
    }),
    { carbsG: 0, sodiumMg: 0, fluidMl: 0 },
  );

  return {
    ...raw,
    need,
    servings,
    supply,
    plainWaterMl: Math.max(need.fluidMl - supply.fluidMl, 0),
  };
}

/**
 * Des remarques, jamais des interdits. La valeur saisie est toujours
 * respectée : l'outil dit ce qu'il en pense et laisse décider.
 *
 * Ce sont des **données**, pas des phrases — voir `Warning`.
 */
function warnings(
  legs: Leg[],
  targets: Targets,
  products: Product[],
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

  return messages;
}
