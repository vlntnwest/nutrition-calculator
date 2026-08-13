import { timeAt } from "./distribute.ts";
import { energyCost } from "./pace.ts";
import type {
  AidStation,
  Fill,
  Flask,
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
  parts?: number[],
): NutritionPlan {
  const legs = provision(
    splitByAidStation(points, aidStations, runner),
    targets,
    products,
    runner,
    parts,
  );

  const units = new Map<string, number>();
  for (const s of legs) {
    for (const r of s.servings) {
      units.set(r.product.id, (units.get(r.product.id) ?? 0) + r.units);
    }
  }

  const carbsG = sum(legs, (s) => s.supply.carbsG);
  const total = {
    durationS: sum(legs, (s) => s.durationS),
    expenditureKcal: sum(legs, (s) => s.expenditureKcal),
    carbsG,
    energyKcal: sum(legs, (s) => s.supply.energyKcal),
    sodiumMg: sum(legs, (s) => s.supply.sodiumMg),
    fluidMl: sum(legs, (s) => s.supply.fluidMl),
    marginG: carbsG - sum(legs, (s) => s.need.carbsG),
    units,
  };

  return { legs, total, warnings: warnings(legs, targets, products, runner) };
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

type Weighted = { product: Product; weight: number };

/** Une charge, avant conversion en unités : voir `Product.divisibleBy`. */
type Loaded = { product: Product; steps: number };

/**
 * En combien de pas se compte une unité. Tout le calcul travaille en pas
 * entiers et ne divise qu'à la toute fin : c'est ce qui permet à la méthode du
 * plus fort reste de s'appliquer telle quelle à un produit sécable.
 */
function stepsOf(product: Product): number {
  const n = Math.floor(product.divisibleBy);

  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Ce que le coureur porte en tout. `null` si rien n'a été déclaré. */
function carryCapacityMl(runner: Runner): number | null {
  if (runner.flasks.length === 0) return null;

  return runner.flasks.reduce((s, f) => s + f.volumeMl, 0);
}

/** Ce qu'il peut préparer en boisson : les flasques non réservées à l'eau. */
function drinkCapacityMl(runner: Runner): number | null {
  if (runner.flasks.length === 0) return null;

  return runner.flasks
    .filter((f) => !f.onlyWater)
    .reduce((s, f) => s + f.volumeMl, 0);
}

function needOf(raw: RawLeg, targets: Targets): Leg["need"] {
  const hours = raw.durationS / 3600;
  const fluidMl = targets.fluidMlH * hours;

  return {
    carbsG: targets.carbsGH * hours,
    fluidMl,
    sodiumMg: (fluidMl / 1000) * targets.sodiumMgL,
  };
}

/**
 * Le partage d'une quantité entre des produits, selon leurs parts.
 *
 * Des parts toutes nulles ne veulent pas dire « rien à personne » : c'est
 * l'absence de consigne, donc le partage à parts égales.
 */
function share(items: Weighted[], amount: number): number[] {
  const totalWeight = items.reduce((s, k) => s + k.weight, 0);

  return items.map((k) =>
    totalWeight > 0 ? (amount * k.weight) / totalWeight : amount / items.length,
  );
}

/**
 * Les trois passes de l'ADR 007.
 *
 * 1. **Le liquide, secteur par secteur.** La contenance d'une flasque est une
 *    contrainte entre deux points d'eau, pas sur la course : on remplit à
 *    chaque passage, rechargement ou pas.
 * 2. **Les solides, une seule fois sur la course.** Un seul arrondi de
 *    quantité, là où trois secteurs en cumulaient trois — 81 g au lieu de 54
 *    sur un semi, mesuré.
 * 3. **Le placement.** Les unités existent déjà ; on ne décide plus que du
 *    secteur où chacune tombe. Répartir ne peut donc rien ajouter au total.
 */
function provision(
  raws: RawLeg[],
  targets: Targets,
  products: Product[],
  runner: Runner,
  parts?: number[],
): Leg[] {
  // La part est lue sur la position d'origine, avant le filtrage : sinon un
  // produit sans glucides décale en silence toutes les parts qui le suivent.
  const kept = products
    .map((product, i) => ({ product, weight: parts?.[i] ?? 1 }))
    .filter(({ product }) => product.carbsG > 0);

  const drinks = kept.filter((k) => k.product.fluidMl > 0);
  const solids = kept.filter((k) => k.product.fluidMl === 0);
  const needs = raws.map((raw) => needOf(raw, targets));
  const loaded: Loaded[][] = raws.map(() => []);

  // Passe 1. Le bidon délivre un flux continu commandé par l'hydratation : ce
  // n'est pas une prise, et ce ne sont pas les glucides qui fixent sa
  // quantité. On arrondit vers le bas pour ne jamais dépasser la cible — le
  // reste se boit en eau claire.
  const capacityMl = drinkCapacityMl(runner);
  const drinkSteps = needs.map((need) => {
    const availableMl =
      capacityMl === null ? need.fluidMl : Math.min(need.fluidMl, capacityMl);

    return share(drinks, availableMl).map((shareMl, i) =>
      Math.floor(
        shareMl / (drinks[i].product.fluidMl / stepsOf(drinks[i].product)),
      ),
    );
  });

  if (solids.length === 0) {
    // Sans solide, la boisson doit porter les glucides seule : on la complète
    // au-delà de la cible d'hydratation, **secteur par secteur** puisque c'est
    // le liquide qui la contraint, et `warnings` le signale plutôt que de
    // laisser le coureur à court.
    for (const [l, steps] of drinkSteps.entries()) {
      const filled = allocateSteps(drinks, needs[l].carbsG, steps);
      for (const [i, k] of drinks.entries()) {
        loaded[l].push({ product: k.product, steps: filled[i] });
      }
    }

    return raws.map((raw, l) =>
      assemble(raw, needs[l], loaded[l], runner.flasks),
    );
  }

  const drinkCarbs = drinkSteps.map((steps) =>
    drinks.reduce(
      (s, k, i) => s + (steps[i] * k.product.carbsG) / stepsOf(k.product),
      0,
    ),
  );

  for (const [l, steps] of drinkSteps.entries()) {
    for (const [i, k] of drinks.entries()) {
      loaded[l].push({ product: k.product, steps: steps[i] });
    }
  }

  // Passe 2. Le seul arrondi de quantité du plan.
  const solidSteps = allocateSteps(
    solids,
    Math.max(
      sum(needs, (n) => n.carbsG) - drinkCarbs.reduce((s, x) => s + x, 0),
      0,
    ),
  );

  // Passe 3. Le poids d'un secteur est son **déficit**, pas sa durée : la
  // durée est déjà dans le besoin, et le déficit corrige en plus les secteurs
  // que la boisson couvre déjà — l'arrondi à la dose entière fait qu'elle ne
  // les couvre pas proportionnellement.
  const deficits = needs.map((n, l) => Math.max(n.carbsG - drinkCarbs[l], 0));
  for (const [i, k] of solids.entries()) {
    for (const [l, steps] of apportion(solidSteps[i], deficits).entries()) {
      loaded[l].push({ product: k.product, steps });
    }
  }

  return raws.map((raw, l) =>
    assemble(raw, needs[l], loaded[l], runner.flasks),
  );
}

/**
 * Comble un besoin en glucides avec des pas entiers, sans jamais passer
 * dessous. Rend un nombre de **pas** par produit.
 *
 * Arrondir au supérieur produit par produit cumulerait les excès — 225 g visés
 * devenaient 300 g apportés. On part du plancher et on ne rajoute que le
 * nécessaire, en servant à chaque tour celui qui est le plus loin de sa part.
 *
 * @param floors Point de départ, quand des pas sont déjà décidés ailleurs.
 */
function allocateSteps(
  items: Weighted[],
  needG: number,
  floors?: number[],
): number[] {
  if (items.length === 0) return [];

  // Un besoin non fini ne se comble pas : la boucle de complément ci-dessous
  // ne s'arrêterait jamais, et un gel se diagnostique plus mal qu'une
  // exception. `targets.carbsGH` vient de l'appelant et n'est validé nulle
  // part — le noyau alerte sur les valeurs hors norme, il ne les écrête pas.
  if (!Number.isFinite(needG)) return floors ? [...floors] : items.map(() => 0);

  const ideal = share(items, needG);
  const stepG = items.map((k) => k.product.carbsG / stepsOf(k.product));
  // Copié : `floors` appartient à l'appelant, qui s'en ressert.
  const steps = floors
    ? [...floors]
    : items.map((_, i) => Math.floor(ideal[i] / stepG[i]));
  const supplied = () => steps.reduce((s, n, i) => s + n * stepG[i], 0);

  while (supplied() < needG) {
    let chosen = 0;
    let worst = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < items.length; i++) {
      const gap = ideal[i] - steps[i] * stepG[i];
      if (gap > worst) {
        worst = gap;
        chosen = i;
      }
    }
    steps[chosen]++;
  }

  return steps;
}

/**
 * Répartit des pas entiers sur les secteurs, au prorata de leurs poids — la
 * méthode du plus fort reste.
 *
 * C'est `allocateSteps` un cran plus haut, sur un autre axe : on n'arrondit
 * plus une quantité mais un **placement**, et la somme est donc conservée par
 * construction. Répartir ne peut rien créer.
 *
 * À fraction égale, le secteur **le plus tardif** l'emporte — on ne mange pas
 * dans la première demi-heure, le glycogène hépatique couvre. C'est ce
 * départage que verrouille l'invariant des secteurs jumeaux.
 */
function apportion(total: number, weights: number[]): number[] {
  const placed = weights.map(() => 0);
  if (total <= 0 || weights.length === 0) return placed;

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  // Plus rien à combler nulle part — la boisson couvre tout, ou la course est
  // de durée nulle. Il faut bien poser ces unités : au dernier secteur, pour
  // la même raison que le départage ci-dessus.
  if (totalWeight <= 0) {
    placed[placed.length - 1] = total;

    return placed;
  }

  const ideal = weights.map((w) => (total * w) / totalWeight);
  for (const [l, x] of ideal.entries()) placed[l] = Math.floor(x);

  const order = ideal
    .map((x, l) => ({ l, fraction: x - Math.floor(x) }))
    .sort((a, b) => b.fraction - a.fraction || b.l - a.l);

  let left = total - placed.reduce((s, n) => s + n, 0);
  for (const { l } of order) {
    if (left <= 0) break;
    placed[l]++;
    left--;
  }

  return placed;
}

/**
 * Le remplissage des contenants au départ du secteur.
 *
 * La boisson préparée va d'abord dans les flasques qui l'acceptent, l'eau
 * claire occupe ensuite celles qui restent vides — `onlyWater` comprises. Une
 * flasque déjà servie n'est jamais complétée : y ajouter de l'eau diluerait la
 * boisson, y ajouter une seconde poudre en changerait la composition.
 *
 * Ce qui ne tient nulle part n'est pas perdu de vue : il ressort en `refillMl`,
 * et le surplus de boisson déclenche en plus une remarque.
 */
function fill(
  flasks: Flask[],
  drinks: Serving[],
  totalMl: number,
): { fills: Fill[]; refillMl: number } {
  if (flasks.length === 0) return { fills: [], refillMl: 0 };

  const fills: Fill[] = [];
  const free = flasks.map((_, i) => i);

  for (const r of drinks) {
    let leftMl = r.units * r.product.fluidMl;
    while (leftMl > 0) {
      const at = free.findIndex((i) => !flasks[i].onlyWater);
      if (at < 0) break;

      const [i] = free.splice(at, 1);
      const volumeMl = Math.min(leftMl, flasks[i].volumeMl);
      fills.push({ flaskIndex: i, product: r.product, volumeMl });
      leftMl -= volumeMl;
    }
  }

  let waterMl = Math.max(totalMl - sum(fills, (f) => f.volumeMl), 0);
  while (waterMl > 0 && free.length > 0) {
    const i = free.shift() as number;
    const volumeMl = Math.min(waterMl, flasks[i].volumeMl);
    fills.push({ flaskIndex: i, product: null, volumeMl });
    waterMl -= volumeMl;
  }

  return {
    fills: fills.sort((a, b) => a.flaskIndex - b.flaskIndex),
    refillMl: Math.max(totalMl - sum(fills, (f) => f.volumeMl), 0),
  };
}

/** Un secteur chargé : les pas deviennent des unités, et on somme. */
function assemble(
  raw: RawLeg,
  need: Leg["need"],
  loaded: Loaded[],
  flasks: Flask[],
): Leg {
  const servings: Serving[] = loaded
    .filter((x) => x.steps > 0)
    .map((x) => ({ product: x.product, units: x.steps / stepsOf(x.product) }));

  const supply = servings.reduce(
    (s, r) => ({
      carbsG: s.carbsG + r.units * r.product.carbsG,
      energyKcal: s.energyKcal + r.units * r.product.energyKcal,
      sodiumMg: s.sodiumMg + r.units * r.product.sodiumMg,
      fluidMl: s.fluidMl + r.units * r.product.fluidMl,
    }),
    { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 },
  );

  // Tout le liquide qui doit passer sur ce secteur. La boisson peut dépasser
  // la cible d'hydratation quand elle porte les glucides seule : c'est alors
  // elle qui commande, pas le besoin.
  const totalMl = Math.max(need.fluidMl, supply.fluidMl);

  return {
    ...raw,
    need,
    servings,
    supply,
    marginG: supply.carbsG - need.carbsG,
    plainWaterMl: Math.max(need.fluidMl - supply.fluidMl, 0),
    ...fill(
      flasks,
      servings.filter((r) => r.product.fluidMl > 0),
      totalMl,
    ),
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
  runner: Runner,
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

  const carryMl = carryCapacityMl(runner);
  const hasCarbDrink = products.some((p) => p.carbsG > 0 && p.fluidMl > 0);

  for (const [legIndex, s] of legs.entries()) {
    if (s.durationS > 0 && s.supply.fluidMl > s.need.fluidMl) {
      messages.push({
        code: "leg-fluid-above-target",
        legIndex,
        supplyMl: s.supply.fluidMl,
        needMl: s.need.fluidMl,
      });
    }

    // Ce qu'il faut réellement porter : le plus contraignant de ce qu'on doit
    // boire et de ce que la boisson préparée occupe.
    const requiredMl = Math.max(s.need.fluidMl, s.supply.fluidMl);
    if (carryMl !== null && requiredMl > carryMl) {
      messages.push({
        code: "leg-fluid-above-carry",
        legIndex,
        requiredMl,
        carryMl,
      });
    }

    // Le cas silencieux d'avant l'ADR 007 : une boisson glucidique était
    // cochée, aucune dose n'entre dans ce secteur, tout part en eau claire.
    if (hasCarbDrink && s.supply.fluidMl === 0 && s.plainWaterMl > 0) {
      messages.push({
        code: "leg-drink-unused",
        legIndex,
        plainWaterMl: s.plainWaterMl,
      });
    }

    // La boisson préparée ne tient pas dans les flasques qui l'acceptent. Sans
    // ça, la ventilation laisserait le surplus disparaître de la liste.
    const drinkCap = drinkCapacityMl(runner);
    if (drinkCap !== null && s.supply.fluidMl > drinkCap) {
      messages.push({
        code: "leg-drink-above-flasks",
        legIndex,
        drinkMl: s.supply.fluidMl,
        capacityMl: drinkCap,
      });
    }
  }

  return messages;
}
