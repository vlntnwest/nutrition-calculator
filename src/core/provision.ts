import {
  allocateSteps,
  apportion,
  consolidate,
  type Loaded,
  rebalance,
  share,
  stepsOf,
} from "./allocate.ts";
import { drinkCapacityMl, fillSpans, imposeFills } from "./fill.ts";
import { sum } from "./sum.ts";
import type {
  AidStation,
  Imposed,
  Leg,
  Product,
  RawLeg,
  Runner,
  Serving,
  Targets,
} from "./type.ts";

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
export function provision(
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

  // La contenance ne se renouvelle qu'aux points d'eau, pas à chaque secteur :
  // sur une portée qui franchit un ravito sec, elle se partage entre ses
  // secteurs au prorata de leur soif. La donner entière à chacun préparait la
  // même flasque deux fois — 500 mL de contenant pour 1 000 mL de poudre
  // dosée, que `leg-drink-above-flasks` signalait sans que le plan y renonce.
  //
  // Une portée d'un seul secteur — le cas dès que le ravito suivant donne de
  // l'eau — retrouve la contenance entière, comme avant.
  const partMl = raws.map(() => Number.POSITIVE_INFINITY);
  if (capacityMl !== null) {
    for (const span of spans) {
      const soifMl = span.reduce((t, l) => t + needs[l].fluidMl, 0);
      for (const l of span) {
        partMl[l] =
          soifMl > 0
            ? (capacityMl * needs[l].fluidMl) / soifMl
            : capacityMl / span.length;
      }
    }
  }

  // La part visée de chaque boisson, cumulée depuis le départ, et ce qu'elle a
  // reçu. C'est leur écart qui désigne la boisson du secteur suivant : sans ce
  // suivi, la même l'emporterait à chaque fois et l'autre ne servirait jamais.
  const idealMl = drinks.map(() => 0);
  const givenMl = drinks.map(() => 0);

  const drinkSteps = needs.map((need, l) => {
    const availableMl = Math.min(need.fluidMl, partMl[l]);
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
