import { pacingError, timeAt } from "./distribute.ts";
import { energyCost } from "./pace.ts";
import type {
  AidStation,
  Fill,
  FixedSpan,
  Flask,
  Imposed,
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
 * L'écart toléré entre ce qu'on sert et ce qu'on vise, en glucides.
 *
 * Une boisson concentrée traîne ses glucides avec le liquide : viser bas en
 * glucides tout en buvant beaucoup dépasse la cible sans qu'on l'ait demandé,
 * et le solide n'a plus sa place. On tolère le rangement — les produits sont
 * discrets, un gel de trop dépasse de quelques pour cent — pas le structurel.
 */
export const CARBS_OVERSHOOT_MAX = 1.3;

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

function sum<T>(items: T[], read: (item: T) => number): number {
  return items.reduce((s, item) => s + read(item), 0);
}

/**
 * Les ravitos réellement sur le parcours, dans l'ordre. Ce qui tombe au départ,
 * à l'arrivée ou au-delà n'en est pas un.
 *
 * `movingTimeS`, `fixedSpans` et `splitByAidStation` s'appuient tous les trois
 * dessus : filtrer différemment d'un côté ou de l'autre ferait retrancher du
 * temps visé un arrêt que le découpage n'applique jamais, et l'arrivée
 * manquerait l'objectif sans que rien ne le dise.
 */
function onCourse(aidStations: AidStation[], endM: number): AidStation[] {
  return [...aidStations]
    .filter((r) => r.distanceM > 0 && r.distanceM < endM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * Les portées de ravitaillement, en indices de secteurs. Chacune va d'une
 * borne qui réapprovisionne à la suivante : ce qu'on y prend doit tenir
 * jusqu'au bout de la portée.
 *
 * Une borne qui ne fournit pas ne rouvre rien — la portée la franchit et
 * continue. Le départ, lui, fournit toujours : on part avec ses flasques
 * pleines et son sac fait.
 *
 * @param provides Ce qu'on cherche à la borne : de l'eau, ou de quoi manger.
 */
function carrySpans(
  aidStations: AidStation[],
  totalDistanceM: number,
  legCount: number,
  provides: (station: AidStation) => boolean | undefined,
): number[][] {
  const bounds = onCourse(aidStations, totalDistanceM);
  const spans: number[][] = [];

  for (let l = 0; l < legCount; l++) {
    // Le secteur `l` part de la borne `l - 1`.
    const at = l === 0 ? undefined : bounds[l - 1];
    const opens = at === undefined || provides(at) !== false;

    if (opens || spans.length === 0) spans.push([l]);
    else spans[spans.length - 1].push(l);
  }

  return spans;
}

/** L'arrêt d'un ravito, en secondes. Absent ou négatif vaut zéro. */
function stopOf(aidStation: AidStation | null): number {
  return Math.max(aidStation?.stopS ?? 0, 0);
}

/**
 * Le temps de mouvement : le temps visé, arrêts déduits. **C'est lui qu'il
 * faut passer à `distributeTime`**, jamais le temps visé brut.
 *
 * Dix minutes de ravito demandent d'aller plus vite entre les ravitos, pas
 * partout un peu moins vite. Répartir le temps total revient pourtant à ça :
 * les arrêts se diluent sur toute la trace, chaque secteur reçoit une durée
 * légèrement excédentaire, les horaires de passage dérivent d'autant, et les
 * besoins d'un secteur se calculent sur du temps passé debout à une table.
 *
 * @param totalDistanceM Longueur du parcours, pour ignorer les ravitos qui
 *   n'y tombent pas — le même filtre que `splitByAidStation`.
 */
export function movingTimeS(
  targetTimeS: number,
  aidStations: AidStation[],
  totalDistanceM: number,
): number {
  const stops = sum(onCourse(aidStations, totalDistanceM), (r) => stopOf(r));

  // Un objectif entièrement mangé par les arrêts n'a pas de solution plus
  // lente : il n'en a aucune. Le taire donnerait une allure nulle ou négative
  // qui contaminerait toute la trace en silence.
  if (stops >= targetTimeS) {
    throw pacingError(
      { code: "stops-above-target", stopS: stops, targetTimeS },
      "Aid station stops leave no time to move",
    );
  }

  return targetTimeS - stops;
}

/**
 * Les portions de trace dont la durée est **imposée**, dans l'ordre : chacune
 * va de la borne qui la précède — le ravito d'avant, ou le départ — au ravito
 * qui porte la consigne.
 *
 * Un ravito sans `legDurationS` n'en ouvre aucune, mais il borne quand même
 * celle qui suit : c'est le découpage en secteurs qui commande, pas la liste
 * des consignes.
 *
 * @param finishLegDurationS Le dernier secteur n'est clos par aucun ravito :
 *   sa consigne ne peut pas voyager sur un `AidStation` et arrive donc à part.
 *   Sans elle, il serait le seul secteur à ne pas pouvoir être réglé.
 */
export function fixedSpans(
  aidStations: AidStation[],
  totalDistanceM: number,
  finishLegDurationS?: number,
): FixedSpan[] {
  const spans: FixedSpan[] = [];
  let startM = 0;

  for (const ravito of onCourse(aidStations, totalDistanceM)) {
    if (ravito.legDurationS !== undefined) {
      spans.push({
        startM,
        endM: ravito.distanceM,
        durationS: ravito.legDurationS,
      });
    }
    startM = ravito.distanceM;
  }

  if (finishLegDurationS !== undefined) {
    spans.push({
      startM,
      endM: totalDistanceM,
      durationS: finishLegDurationS,
    });
  }

  return spans;
}

/**
 * Découpe la trace aux ravitos. Le premier secteur part du départ, le dernier
 * arrive à l'arrivée : un roadbook sans ravito donne donc un secteur unique.
 *
 * `points` porte le temps de **mouvement** — c'est ce que `distributeTime`
 * répartit. Les arrêts sont réintroduits ici, en décalant les horaires de
 * passage de tout ce qui a été perdu en amont, sans jamais toucher aux durées.
 */
export function splitByAidStation(
  points: TimedPoint[],
  aidStations: AidStation[],
  runner: Runner,
): RawLeg[] {
  if (points.length < 2) return [];

  const endM = points[points.length - 1].d;
  const bounds = onCourse(aidStations, endM);

  const legs: RawLeg[] = [];
  let startM = 0;
  // `null` aux deux bouts : « Départ » et « Arrivée » sont des mots, donc
  // l'affaire de l'affichage. Le nom d'un ravito, lui, vient du roadbook.
  let from: string | null = null;
  let i = 1;
  /** Tout ce qui a été perdu aux ravitos en amont du secteur courant. */
  let stoppedS = 0;

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

    // Les deux bornes reçoivent le même décalage, donc `durationS` reste du
    // temps de mouvement pur : l'arrêt d'un ravito sépare l'arrivée d'un
    // secteur du départ du suivant, il ne rallonge aucun des deux.
    const startS = timeAt(points, startM) + stoppedS;
    const arrivalS = timeAt(points, boundM) + stoppedS;
    const stopS = stopOf(ravito);

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
      stopS,
      expenditureKcal: (joules * runner.massKg) / JOULES_PER_KCAL,
    });

    stoppedS += stopS;
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
  aidStations: AidStation[],
  targets: Targets,
  products: Product[],
  runner: Runner,
  spans: number[][],
  parts?: number[],
  finishTargets?: Partial<Targets>,
  given?: Imposed,
): Leg[] {
  // La part est lue sur la position d'origine, avant le filtrage : sinon un
  // produit sans glucides décale en silence toutes les parts qui le suivent.
  const kept = products
    .map((product, i) => ({ product, weight: parts?.[i] ?? 1 }))
    .filter(({ product }) => product.carbsG > 0);

  const drinks = kept.filter((k) => k.product.fluidMl > 0);
  const solids = kept.filter((k) => k.product.fluidMl === 0);
  // Une cible imposée se range sur le ravito qui clôt le secteur, et à part
  // pour l'arrivée. Partielle, elle ne remplace que ce qu'elle donne.
  const imposed = new Map(aidStations.map((a) => [a.name, a.legTargets]));
  const legTargets = raws.map((raw) => ({
    ...targets,
    ...(raw.to === null ? finishTargets : imposed.get(raw.to)),
  }));
  const needs = raws.map((raw, l) => needOf(raw, legTargets[l]));

  // Une consigne rend les trois passes sans objet : il n'y a plus rien à
  // décider, seulement à sommer.
  if (given) {
    const assembled = raws.map((raw, l) =>
      assemble(raw, needs[l], imposedOf(given, products, l)),
    );

    return given.fills
      ? imposeFills(assembled, spans, given.fills, products)
      : fillSpans(assembled, spans, runner.flasks);
  }

  const loaded: Loaded[][] = raws.map(() => []);

  // Passe 1. Le bidon délivre un flux continu commandé par l'hydratation : ce
  // n'est pas une prise, et ce ne sont pas les glucides qui fixent sa
  // quantité. On arrondit vers le bas pour ne jamais dépasser la cible — le
  // reste se boit en eau claire.
  const capacityMl = drinkCapacityMl(runner);

  // La part visée de chaque boisson, cumulée depuis le départ, et ce qu'elle a
  // reçu. C'est leur écart qui désigne la boisson du secteur suivant : sans ce
  // suivi, la même l'emporterait à chaque fois et l'autre ne servirait jamais.
  const idealMl = drinks.map(() => 0);
  const givenMl = drinks.map(() => 0);

  const drinkSteps = needs.map((need) => {
    const availableMl =
      capacityMl === null ? need.fluidMl : Math.min(need.fluidMl, capacityMl);
    for (const [i, ml] of share(drinks, availableMl).entries()) {
      idealMl[i] += ml;
    }

    const steps = drinks.map(() => 0);

    // Une seule boisson par secteur : on ne mélange pas deux poudres, pas plus
    // dans une flasque que dans un gobelet. La retardataire passe devant.
    //
    // Une dose entière : la première s'arrondit au plus proche, sans quoi un
    // secteur réclamant 478 mL n'aurait pas droit à un sachet de 500 et
    // partirait sans rien. Les suivantes exigent la place entière — au plus
    // proche partout, la boisson couvrirait tous les glucides et il ne
    // resterait plus rien à manger.
    let chosen = -1;
    let worst = Number.NEGATIVE_INFINITY;
    for (const [i, k] of drinks.entries()) {
      if (k.product.fluidMl > availableMl * 2) continue;
      const gap = idealMl[i] - givenMl[i];
      if (gap > worst) {
        worst = gap;
        chosen = i;
      }
    }
    if (chosen < 0) return steps;

    const product = drinks[chosen].product;
    let doses = 1;
    let leftMl = availableMl - product.fluidMl;
    while (product.fluidMl <= leftMl) {
      doses++;
      leftMl -= product.fluidMl;
    }

    steps[chosen] = doses * stepsOf(product);
    givenMl[chosen] += doses * product.fluidMl;

    return steps;
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

    return fillSpans(
      raws.map((raw, l) => assemble(raw, needs[l], servingsOf(loaded[l]))),
      spans,
      runner.flasks,
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

  // Le déficit se consomme d'un produit à l'autre. Le laisser entier à chaque
  // fois le compterait autant de fois qu'il y a de solides : un secteur
  // recevrait beaucoup de gaufres **et** beaucoup de barres pendant qu'un
  // autre n'aurait ni l'une ni l'autre.
  for (const [i, k] of solids.entries()) {
    const stepG = k.product.carbsG / stepsOf(k.product);

    for (const [l, steps] of apportion(solidSteps[i], deficits).entries()) {
      loaded[l].push({ product: k.product, steps });
      deficits[l] = Math.max(deficits[l] - steps * stepG, 0);
    }
  }

  const carbNeeds = needs.map((n) => n.carbsG);
  consolidate(loaded, carbNeeds);
  rebalance(loaded, carbNeeds);

  return fillSpans(
    raws.map((raw, l) => assemble(raw, needs[l], servingsOf(loaded[l]))),
    spans,
    runner.flasks,
  );
}

/**
 * Les remplissages tels qu'on les impose.
 *
 * Ce qu'ils ne portent pas ressort en `refillMl`, au même endroit que dans
 * `fillSpans` : à l'ouverture de la portée. On ne verse qu'à cette
 * ouverture-là — une consigne posée plus loin dans la portée se refuse.
 */
function imposeFills(
  legs: Omit<Leg, "fills" | "refillMl">[],
  spans: number[][],
  given: NonNullable<Imposed["fills"]>,
  products: Product[],
): Leg[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const filled = legs.map((leg, l) => ({
    ...leg,
    refillMl: 0,
    fills: given[l].map((f) => {
      if (f.productId === null) {
        return {
          flaskIndex: f.flaskIndex,
          product: null,
          volumeMl: f.volumeMl,
        };
      }

      const product = byId.get(f.productId);
      if (!product) throw new Error(`Unknown product: ${f.productId}`);

      return { flaskIndex: f.flaskIndex, product, volumeMl: f.volumeMl };
    }),
  }));

  for (const span of spans) {
    // Une flasque se remplit là où l'on ravitaille. Versé plus loin dans la
    // portée, le liquide ne serait jamais accessible mais compterait comme
    // porté : il éteindrait en silence le `refillMl` qui le réclame.
    for (const l of span.slice(1)) {
      if (filled[l].fills.length > 0) {
        throw new Error(`Fill outside the opening leg of a carry span: ${l}`);
      }
    }

    const totalMl = span.reduce(
      (s, l) => s + Math.max(legs[l].need.fluidMl, legs[l].supply.fluidMl),
      0,
    );
    const carried = sum(filled[span[0]].fills, (f) => f.volumeMl);
    filled[span[0]].refillMl = Math.max(totalMl - carried, 0);
  }

  return filled;
}

/**
 * Verse le liquide d'une portée à son ouverture. Les secteurs qui partent d'un
 * ravito sans eau ne reçoivent rien : leur liquide a été chargé en amont.
 */
function fillSpans(
  legs: Omit<Leg, "fills" | "refillMl">[],
  spans: number[][],
  flasks: Flask[],
): Leg[] {
  const filled = legs.map((leg) => ({ ...leg, fills: [], refillMl: 0 }) as Leg);

  for (const span of spans) {
    const totalMl = span.reduce(
      (s, l) => s + Math.max(legs[l].need.fluidMl, legs[l].supply.fluidMl),
      0,
    );
    // La boisson de toute la portée se prépare d'un coup : les doses des
    // secteurs qu'elle couvre se regroupent par produit.
    const drinks: Serving[] = [];
    for (const l of span) {
      for (const r of legs[l].servings) {
        if (r.product.fluidMl === 0) continue;
        const at = drinks.find((d) => d.product.id === r.product.id);
        if (at) at.units += r.units;
        else drinks.push({ product: r.product, units: r.units });
      }
    }

    filled[span[0]] = { ...filled[span[0]], ...fill(flasks, drinks, totalMl) };
  }

  return filled;
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

  // Une flasque qu'on emporte part pleine : on ne court pas avec un fond, et
  // mieux vaut du rab que d'en manquer. Ce qu'il **faut** boire est dit à
  // part, par `need.fluidMl` — le volume versé ne le remplace pas.
  //
  // Un sachet qui ne remplit pas sa flasque la remplit quand même : la
  // boisson est alors plus diluée que nominale. C'est un choix assumé.
  for (const r of drinks) {
    let leftMl = r.units * r.product.fluidMl;
    while (leftMl > 0) {
      const at = free.findIndex((i) => !flasks[i].onlyWater);
      if (at < 0) break;

      const [i] = free.splice(at, 1);
      fills.push({
        flaskIndex: i,
        product: r.product,
        volumeMl: flasks[i].volumeMl,
      });
      leftMl -= flasks[i].volumeMl;
    }
  }

  let waterMl = Math.max(totalMl - sum(fills, (f) => f.volumeMl), 0);
  while (waterMl > 0 && free.length > 0) {
    const i = free.shift() as number;
    fills.push({ flaskIndex: i, product: null, volumeMl: flasks[i].volumeMl });
    waterMl -= flasks[i].volumeMl;
  }

  return {
    fills: fills.sort((a, b) => a.flaskIndex - b.flaskIndex),
    refillMl: Math.max(totalMl - sum(fills, (f) => f.volumeMl), 0),
  };
}

/**
 * Ramène chaque secteur à **une** fraction au plus.
 *
 * Une répartition en pas laisse des comptes impairs un peu partout : quatre
 * produits divisibles par deux, et le coureur coupe quatre emballages au même
 * ravito. Une moitié reste utile — c'est l'ajustement qui évite de dépasser
 * la cible d'une unité entière — mais une seule, et par secteur.
 *
 * Deux secteurs portant chacun une moitié du **même** produit peuvent
 * l'échanger : un pas déplacé les rend tous deux entiers, et la somme est
 * conservée. C'est le manque **du moment** qui décide du sens — ce qu'il
 * reste à couvrir une fois compté ce que le secteur porte déjà, et non le
 * déficit d'avant répartition, qui laisserait un secteur bien servi
 * continuer de recevoir.
 *
 * On ne touche qu'aux secteurs qui en portent plusieurs. Regrouper au-delà
 * déplacerait des rations hors des secteurs qui en ont besoin.
 */
function consolidate(loaded: Loaded[][], needsG: number[]): void {
  // Une boisson n'a rien à regrouper ici : sa quantité est commandée par
  // l'hydratation du secteur, pas par ses glucides.
  const divisible = (i: number) =>
    stepsOf(loaded[0][i].product) > 1 && loaded[0][i].product.fluidMl === 0;
  const fraction = (l: number, i: number) =>
    loaded[l][i].steps % stepsOf(loaded[l][i].product) !== 0;
  const combien = (l: number) =>
    loaded[l].reduce(
      (n, _, i) => n + (divisible(i) && fraction(l, i) ? 1 : 0),
      0,
    );
  // Ce qu'il reste à couvrir, recalculé à chaque échange : c'est lui qui
  // désigne le receveur, pas une estimation faite avant la répartition — un
  // secteur déjà bien servi continuerait sinon de recevoir.
  const manque = (l: number) =>
    needsG[l] -
    loaded[l].reduce(
      (g, x) => g + (x.steps * x.product.carbsG) / stepsOf(x.product),
      0,
    );

  const bloques = new Set<number>();

  for (;;) {
    // Le secteur le plus encombré d'abord, et lui seul : ceux qui n'en
    // portent qu'une gardent la leur.
    let charge = -1;
    let pire = 1;
    for (let l = 0; l < loaded.length; l++) {
      if (bloques.has(l)) continue;
      const n = combien(l);
      if (n > pire) {
        pire = n;
        charge = l;
      }
    }
    if (charge < 0) break;

    // Une de ses fractions, appariée avec un autre secteur qui porte une
    // moitié du même produit — de préférence un autre encombré, qu'on soulage
    // du même coup.
    let echange = false;
    for (let i = 0; i < loaded[charge].length && !echange; i++) {
      if (!divisible(i) || !fraction(charge, i)) continue;

      const partenaire = loaded
        .map((_, m) => m)
        .filter((m) => m !== charge && fraction(m, i))
        .sort((a, b) => combien(b) - combien(a) || manque(b) - manque(a))[0];
      if (partenaire === undefined) continue;

      const [recoit, cede] =
        manque(charge) >= manque(partenaire)
          ? [charge, partenaire]
          : [partenaire, charge];
      loaded[recoit][i].steps += 1;
      loaded[cede][i].steps -= 1;
      echange = true;
    }

    // Aucune de ses moitiés n'a de partenaire : on ne peut rien pour lui.
    if (!echange) bloques.add(charge);
  }
}

/**
 * Rapproche chaque secteur de sa cible, un pas à la fois.
 *
 * Le regroupement ne fait que supprimer des fractions ; il ne casse jamais une
 * unité entière, même quand ce serait la bonne chose à faire. Un secteur à
 * +12 g portant une gaufre entière peut en céder la moitié à celui qui est à
 * −10 : les deux se rapprochent de zéro, et le compte de fractions ne monte
 * nulle part au-delà d'une.
 *
 * On déplace un pas du plus servi vers le plus démuni tant que la somme de
 * leurs écarts absolus diminue — ce qui borne la boucle : cette somme décroît
 * strictement et ne peut pas passer sous zéro.
 */
function rebalance(loaded: Loaded[][], needsG: number[]): void {
  const divisible = (i: number) =>
    stepsOf(loaded[0][i].product) > 1 && loaded[0][i].product.fluidMl === 0;
  const fractions = (l: number, sauf = -1, delta = 0) =>
    loaded[l].reduce((n, x, i) => {
      const steps = x.steps + (i === sauf ? delta : 0);
      const impair = divisible(i) && steps % stepsOf(x.product) !== 0;

      return n + (impair ? 1 : 0);
    }, 0);
  const ecart = (l: number, sauf = -1, delta = 0) =>
    loaded[l].reduce(
      (g, x, i) =>
        g +
        ((x.steps + (i === sauf ? delta : 0)) * x.product.carbsG) /
          stepsOf(x.product),
      0,
    ) - needsG[l];

  // On cherche le meilleur déplacement sur **toutes** les paires, pas
  // seulement sur les deux extrêmes : le secteur le plus servi n'a pas
  // toujours de quoi céder au plus démuni sans lui donner deux fractions.
  for (;;) {
    // Un seuil plutôt que zéro : un gain issu du bruit flottant relancerait la
    // boucle indéfiniment, et un dixième de gramme ne veut rien dire ici.
    let gain = 0.1;
    let move: [number, number, number] | null = null;

    for (let a = 0; a < loaded.length; a++) {
      for (let b = 0; b < loaded.length; b++) {
        if (a === b) continue;

        for (let i = 0; i < loaded[a].length; i++) {
          if (!divisible(i) || loaded[a][i].steps < 1) continue;

          const avant = Math.abs(ecart(a)) + Math.abs(ecart(b));
          const apres = Math.abs(ecart(a, i, -1)) + Math.abs(ecart(b, i, 1));
          if (avant - apres <= gain) continue;

          // La règle tient des deux côtés : une fraction par secteur, pas plus.
          if (fractions(a, i, -1) > 1 || fractions(b, i, 1) > 1) continue;

          gain = avant - apres;
          move = [a, b, i];
        }
      }
    }

    if (move === null) return;

    const [a, b, i] = move;
    loaded[a][i].steps -= 1;
    loaded[b][i].steps += 1;
  }
}

/** Les pas d'un secteur, devenus des unités. */
function servingsOf(loaded: Loaded[]): Serving[] {
  return loaded
    .filter((x) => x.steps > 0)
    .map((x) => ({ product: x.product, units: x.steps / stepsOf(x.product) }));
}

/**
 * Les rations imposées sur un secteur, rangées sur le pas de chaque produit.
 *
 * L'arrondi tient ici et pas chez l'appelant : c'est `Serving.units` qui porte
 * l'invariant, et un demi-gel n'existe pas davantage parce qu'un humain l'a
 * saisi. Ce qui tombe sous le demi-pas disparaît.
 */
function imposedOf(
  given: Imposed,
  products: Product[],
  leg: number,
): Serving[] {
  const byId = new Map(products.map((p) => [p.id, p]));

  return given.servings[leg].flatMap((r) => {
    const product = byId.get(r.productId);
    if (!product) throw new Error(`Unknown product: ${r.productId}`);

    const steps = Math.round(r.units * stepsOf(product));

    return steps > 0 ? [{ product, units: steps / stepsOf(product) }] : [];
  });
}

/** Un secteur chargé : on somme ce qu'il porte. */
function assemble(
  raw: RawLeg,
  need: Leg["need"],
  servings: Serving[],
): Omit<Leg, "fills" | "refillMl"> {
  const supply = servings.reduce(
    (s, r) => ({
      carbsG: s.carbsG + r.units * r.product.carbsG,
      energyKcal: s.energyKcal + r.units * r.product.energyKcal,
      sodiumMg: s.sodiumMg + r.units * r.product.sodiumMg,
      fluidMl: s.fluidMl + r.units * r.product.fluidMl,
    }),
    { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 },
  );

  return {
    ...raw,
    need,
    servings,
    supply,
    marginG: supply.carbsG - need.carbsG,
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

    // Le cas silencieux d'avant l'ADR 007 : une boisson glucidique était
    // cochée, aucune dose n'entre dans ce secteur, tout part en eau claire.
    if (hasCarbDrink && s.supply.fluidMl === 0 && s.plainWaterMl > 0) {
      messages.push({
        code: "leg-drink-unused",
        legIndex,
        plainWaterMl: s.plainWaterMl,
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
