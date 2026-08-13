import fc from "fast-check";
import { expect, test } from "vitest";
import {
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
  nutritionPlan,
  splitByAidStation,
  suggestedTargets,
} from "./nutrition";
import { CATALOG, productById } from "./products";
import type {
  AidStation,
  Leg,
  Product,
  Runner,
  Targets,
  TimedPoint,
} from "./type";

/** Contenance non déclarée : le noyau ne borne rien et n'alerte sur rien. */
const RUNNER: Runner = { massKg: 70, flasks: [] };
const TARGETS: Targets = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 600 };

/** Une trace plate de `km` kilomètres, parcourue en `heures`. */
function flatTrack(km: number, hours: number): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= km * 100; i++) {
    points.push({
      lat: 0,
      lon: 0,
      d: i * 10,
      ele: 0,
      t: (i / (km * 100)) * hours * 3600,
    });
  }

  return points;
}

const gel = productById("naak-gel-ultra") as Product;
const drink = productById("naak-drink-ultra") as Product;
const baouwGel = productById("baouw-gel") as Product;
const baouwBar = productById("baouw-bar-extra") as Product;

test("le catalogue est cohérent", () => {
  expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);

  for (const p of CATALOG) {
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

test("sans ravito, la course est un seul secteur", () => {
  const points = flatTrack(40, 5);
  const [leg, ...rest] = splitByAidStation(points, [], RUNNER);

  expect(rest).toEqual([]);
  // Les deux bouts de la course n'ont pas de nom : c'est l'UI qui les nomme.
  expect(leg.from).toBeNull();
  expect(leg.to).toBeNull();
  expect(leg.startM).toBe(0);
  expect(leg.endM).toBe(40_000);
  expect(leg.durationS).toBeCloseTo(5 * 3600, 6);
});

test("les secteurs sont jointifs et couvrent la course", () => {
  const points = flatTrack(40, 5);
  const aidStations: AidStation[] = [
    { name: "Ravito 2", distanceM: 25_000 },
    { name: "Ravito 1", distanceM: 12_000 }, // volontairement désordonné
  ];
  const legs = splitByAidStation(points, aidStations, RUNNER);

  expect(legs.map((s) => [s.from, s.to])).toEqual([
    [null, "Ravito 1"],
    ["Ravito 1", "Ravito 2"],
    ["Ravito 2", null],
  ]);
  expect(legs[0].startM).toBe(0);
  expect(legs[legs.length - 1].endM).toBe(40_000);
  for (let i = 1; i < legs.length; i++) {
    expect(legs[i].startM).toBe(legs[i - 1].endM);
  }
  expect(legs.reduce((s, x) => s + x.durationS, 0)).toBeCloseTo(5 * 3600, 6);
});

test("un ravito hors parcours est ignoré", () => {
  const points = flatTrack(40, 5);
  const legs = splitByAidStation(
    points,
    [
      { name: "Trop loin", distanceM: 90_000 },
      { name: "Avant le départ", distanceM: -500 },
    ],
    RUNNER,
  );

  expect(legs).toHaveLength(1);
});

// C'est le cœur de l'outil : « sur cette course, à 60 g/h, emporte ça ».
// Depuis l'ADR 007 la garantie porte sur la **course**, plus sur le secteur :
// un secteur peut être en dessous de son besoin propre, l'unité qui lui manque
// étant allée à un autre.
test("la course entière reçoit de quoi tenir", () => {
  const points = flatTrack(40, 6);
  const plan = nutritionPlan(
    points,
    [{ name: "AidStation", distanceM: 20_000 }],
    RUNNER,
    TARGETS,
    [gel, drink],
  );

  expect(plan.legs).toHaveLength(2);

  const needCarbsG = plan.legs.reduce((s, x) => s + x.need.carbsG, 0);
  expect(needCarbsG).toBeCloseTo(360, 6);
  expect(plan.total.carbsG).toBeGreaterThanOrEqual(needCarbsG - 1e-9);
  expect(plan.total.marginG).toBeGreaterThanOrEqual(-1e-9);

  for (const s of plan.legs) {
    expect(s.durationS).toBeCloseTo(3 * 3600, 6);
    expect(s.need.carbsG).toBeCloseTo(180, 6);
    expect(s.servings.length).toBeGreaterThan(0);
    for (const r of s.servings) expect(r.units).toBeGreaterThan(0);
  }
});

/**
 * La mesure qui a motivé l'ADR 007. Chaque secteur arrondissait dans son coin
 * et les marges s'additionnaient : le même semi-marathon donnait 54 g sans
 * ravito et 81 g avec deux. Même course, même coureur, même produit.
 */
test("déclarer des ravitos ne change plus le total", () => {
  const points = flatTrack(21.1, 1.75);
  const targets: Targets = { ...TARGETS, carbsGH: 30 };
  const totalOf = (aidStations: AidStation[]) =>
    nutritionPlan(points, aidStations, RUNNER, targets, [gel]).total.carbsG;

  // 52,5 g de besoin, des gels de 27 g : deux gels, et pas trois.
  expect(totalOf([])).toBeCloseTo(54, 6);
  expect(
    totalOf([
      { name: "R1", distanceM: 7000 },
      { name: "R2", distanceM: 14_000 },
    ]),
  ).toBeCloseTo(54, 6);
});

/** Le placement répartit ce qui existe déjà : il ne peut rien créer. */
test("le placement conserve le sac, quel que soit le découpage", () => {
  const points = flatTrack(60, 8);
  const bag = (aidStations: AidStation[]) =>
    nutritionPlan(points, aidStations, RUNNER, TARGETS, [gel, baouwBar]).total
      .units;

  const alone = bag([]);
  const split = bag([
    { name: "R1", distanceM: 15_000 },
    { name: "R2", distanceM: 33_000 },
    { name: "R3", distanceM: 48_000 },
  ]);

  expect([...split.keys()].sort()).toEqual([...alone.keys()].sort());
  for (const [id, units] of alone) {
    expect(split.get(id)).toBeCloseTo(units, 9);
  }
});

/**
 * L'invariant des secteurs jumeaux. Deux secteurs de même durée ont le même
 * besoin, le même déficit et le même plancher — mais l'étape du reste ne peut
 * donner l'unité supplémentaire qu'à un seul. Un gel ne se coupe pas en deux
 * pour être partagé entre deux secteurs.
 *
 * Le départage se joue sur le sens d'une inégalité, qu'un refactoring distrait
 * inverserait sans rien casser d'autre. C'est ce que ce test verrouille.
 */
test("deux secteurs jumeaux ne diffèrent que d'une unité, en faveur du plus tardif", () => {
  // 4 h à 60 g/h = 240 g, des gels de 27 g : 9 gels pour 2 secteurs égaux.
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [{ name: "Mi-course", distanceM: 20_000 }],
    RUNNER,
    TARGETS,
    [gel],
  );
  const [first, second] = plan.legs;
  const served = (leg: Leg) =>
    leg.servings.find((r) => r.product.id === gel.id)?.units ?? 0;

  expect(first.durationS).toBeCloseTo(second.durationS, 6);
  expect(first.need.carbsG).toBeCloseTo(second.need.carbsG, 6);
  expect(served(first) + served(second)).toBe(9);
  expect(served(second) - served(first)).toBe(1);

  // Le secteur qui a l'unité en trop est donc en marge, l'autre en déficit.
  expect(first.marginG).toBeLessThan(0);
  expect(second.marginG).toBeGreaterThan(0);
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

/**
 * Arrondir au supérieur produit par produit cumulait les excès — 225 g visés
 * devenaient 300 g. On part du plancher, donc l'excès ne peut jamais dépasser
 * une unité : celle qui a fait franchir la cible.
 *
 * Depuis le §6, la borne porte sur **ce qui a servi à combler**, pas sur le
 * total. Le bidon est dimensionné par l'hydratation : ses glucides sont un
 * effet de bord, ils peuvent dépasser la cible sans que rien ne soit arrondi.
 * Ce sont les solides qui comblent — sauf s'il n'y en a aucun, auquel cas la
 * boisson reprend ce rôle.
 */
test("ce qui comble ne dépasse jamais d'une unité", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 20, noNaN: true }),
      fc.double({ min: 0, max: 120, noNaN: true }),
      fc.uniqueArray(fc.constantFrom(...CATALOG), {
        minLength: 1,
        maxLength: 4,
        selector: (p) => p.id,
      }),
      (hours, carbsGH, products) => {
        const leg = nutritionPlan(
          flatTrack(10, hours),
          [],
          RUNNER,
          { ...TARGETS, carbsGH },
          products,
        ).legs[0];

        // On n'est jamais à court, quoi qu'il arrive.
        expect(leg.supply.carbsG).toBeGreaterThanOrEqual(
          leg.need.carbsG - 1e-9,
        );

        // La borne ne vaut que là où il y a quelque chose à combler. Sans
        // solide, c'est l'hydratation qui commande le bidon et ses glucides
        // sont un effet de bord — cas couvert par le test suivant.
        const solids = products.filter((p) => p.fluidMl === 0);
        if (solids.length === 0) return;

        const carbsOf = (fromDrink: boolean) =>
          leg.servings
            .filter((s) => s.product.fluidMl > 0 === fromDrink)
            .reduce((s, r) => s + r.units * r.product.carbsG, 0);

        // Au plus une unité, et non strictement moins : la sommation
        // flottante peut faire tomber l'écart pile sur la taille de l'unité.
        // La borne est le **pas**, pas l'unité : un produit sécable comble
        // plus finement, et c'est tout l'intérêt de `divisibleBy`.
        expect(
          carbsOf(false) - Math.max(leg.need.carbsG - carbsOf(true), 0),
        ).toBeLessThanOrEqual(
          Math.max(...solids.map((p) => p.carbsG / p.divisibleBy)),
        );
      },
    ),
  );
});

/**
 * Sans solide, la boisson doit porter les glucides seule. On la complète alors
 * au-delà de la cible d'hydratation plutôt que de laisser le coureur à court —
 * et c'est l'avertissement qui le dit, pas un chiffre silencieusement faux.
 */
test("sans solide, la boisson est complétée et l'alerte le signale", () => {
  // 5 h à 500 mL/h = 2500 mL, soit 5 doses et 275 g. La cible en demande 400.
  const plan = nutritionPlan(
    flatTrack(40, 5),
    [],
    RUNNER,
    { ...TARGETS, carbsGH: 80 },
    [drink],
  );
  const leg = plan.legs[0];

  expect(leg.supply.carbsG).toBeGreaterThanOrEqual(leg.need.carbsG);
  expect(leg.supply.fluidMl).toBeGreaterThan(leg.need.fluidMl);
  expect(leg.plainWaterMl).toBe(0);
  expect(plan.warnings.some((w) => w.code === "leg-fluid-above-target")).toBe(
    true,
  );
});

/**
 * Le bidon délivre un flux continu : c'est l'hydratation qui le dimensionne,
 * jamais les glucides. Doubler la cible de glucides ne doit donc rien changer
 * au nombre de doses de boisson.
 */
test("la boisson est dimensionnée par l'hydratation, pas par les glucides", () => {
  const points = flatTrack(40, 5);
  const doses = (carbsGH: number) =>
    nutritionPlan(points, [], RUNNER, { ...TARGETS, carbsGH }, [
      gel,
      drink,
    ]).legs[0].servings.find((s) => s.product.id === drink.id)?.units ?? 0;

  expect(doses(60)).toBe(doses(120));
  // 500 mL/h sur 5 h, en doses de 500 mL.
  expect(doses(60)).toBe(5);
});

/**
 * Le poids du placement est le **déficit**, pas la durée. Un secteur que la
 * boisson couvre déjà ne doit recevoir aucun solide — pondéré à la durée, il
 * réclamerait quand même sa part.
 */
test("un secteur que la boisson couvre déjà ne reçoit pas de solide", () => {
  // 2 h à 500 mL/h = 1 000 mL, soit 2 doses et 110 g. La cible en veut 60.
  const plan = nutritionPlan(
    flatTrack(20, 2),
    [],
    RUNNER,
    { ...TARGETS, carbsGH: 30 },
    [drink, gel],
  );
  const leg = plan.legs[0];

  expect(leg.servings.find((r) => r.product.id === drink.id)?.units).toBe(2);
  expect(leg.servings.some((r) => r.product.id === gel.id)).toBe(false);
});

/** Ce qui se coupe comble plus finement. §7, `Product.divisibleBy`. */
test("ce qui se coupe se compte en demies, le reste en entiers", () => {
  const halves = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [
    baouwBar,
  ]);
  const units = halves.legs[0].servings[0].units;

  expect(baouwBar.divisibleBy).toBe(2);
  expect(units % 0.5).toBe(0);
  expect(units % 1).not.toBe(0);
  // La demie étant atteignable, la marge tombe sous la demi-barre.
  expect(halves.total.marginG).toBeLessThan(baouwBar.carbsG / 2);

  const wholes = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [gel]);
  expect(gel.divisibleBy).toBe(1);
  expect(wholes.legs[0].servings[0].units % 1).toBe(0);
});

/**
 * La contenance est une contrainte **par secteur** : on remplit à chaque point
 * d'eau. Le noyau proposait jusqu'ici 2 500 mL à qui porte deux flasques.
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
    requiredMl: 2500,
    carryMl: 1000,
  });

  // La flasque réservée à l'eau ne reçoit pas de poudre : une dose, pas deux.
  expect(
    plan.legs[0].servings.find((r) => r.product.id === drink.id)?.units,
  ).toBe(1);
});

/**
 * La ventilation par contenant. Un contenant ne porte qu'une chose : compléter
 * une boisson à l'eau en changerait la concentration, c'est une règle physique
 * et pas une simplification.
 */
test("chaque flasque porte une seule chose", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 500, onlyWater: true },
    ],
  };
  // 5 h à 500 mL/h : 2 500 mL réclamés pour 1 000 mL portés.
  const leg = nutritionPlan(flatTrack(40, 5), [], runner, TARGETS, [gel, drink])
    .legs[0];

  expect(leg.fills).toEqual([
    { flaskIndex: 0, product: drink, volumeMl: 500 },
    { flaskIndex: 1, product: null, volumeMl: 500 },
  ]);
  expect(leg.refillMl).toBeCloseTo(1500, 6);
  expect(new Set(leg.fills.map((f) => f.flaskIndex)).size).toBe(
    leg.fills.length,
  );

  // Contenance non déclarée : le noyau ne ventile rien plutôt que de supposer
  // un matériel qu'on ne lui a pas donné.
  const bare = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [
    gel,
    drink,
  ]).legs[0];
  expect(bare.fills).toEqual([]);
  expect(bare.refillMl).toBe(0);
});

test("la dernière flasque n'est remplie que de ce qu'il reste", () => {
  const runner: Runner = {
    massKg: 70,
    flasks: [
      { volumeMl: 500, onlyWater: false },
      { volumeMl: 500, onlyWater: true },
      { volumeMl: 500, onlyWater: true },
    ],
  };
  // 1 h 30 à 500 mL/h = 750 mL : une flasque de boisson, un fond d'eau, et la
  // troisième reste au sac.
  const leg = nutritionPlan(flatTrack(12, 1.5), [], runner, TARGETS, [
    gel,
    drink,
  ]).legs[0];

  expect(leg.fills).toEqual([
    { flaskIndex: 0, product: drink, volumeMl: 500 },
    { flaskIndex: 1, product: null, volumeMl: 250 },
  ]);
  expect(leg.refillMl).toBe(0);
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
    drinkMl: 3750,
    capacityMl: 500,
  });
});

/** Le cas qui passait en silence : tout le liquide bascule en eau claire. */
test("une boisson qui n'entre nulle part ne disparaît plus en silence", () => {
  // 15 min à 500 mL/h = 125 mL, moins que la demi-dose de 250.
  const plan = nutritionPlan(
    flatTrack(2, 0.25),
    [],
    RUNNER,
    { ...TARGETS, carbsGH: 30 },
    [gel, drink],
  );
  const leg = plan.legs[0];

  expect(leg.supply.fluidMl).toBe(0);
  expect(leg.plainWaterMl).toBeCloseTo(125, 6);
  expect(plan.warnings).toContainEqual({
    code: "leg-drink-unused",
    legIndex: 0,
    plainWaterMl: 125,
  });
});

test("l'énergie apportée est comptée, et n'est pas la dépense", () => {
  const plan = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [gel]);
  const units = plan.legs[0].servings[0].units;

  expect(plan.total.energyKcal).toBeCloseTo(units * gel.energyKcal, 6);
  // On ne mange jamais sa dépense : le reste vient des graisses.
  expect(plan.total.energyKcal).toBeLessThan(plan.total.expenditureKcal);
});

test("la marge est ce qui dépasse le besoin", () => {
  const leg = nutritionPlan(flatTrack(40, 5), [], RUNNER, TARGETS, [gel])
    .legs[0];

  expect(leg.marginG).toBeCloseTo(leg.supply.carbsG - leg.need.carbsG, 9);
  expect(leg.marginG).toBeGreaterThanOrEqual(0);
  expect(leg.marginG).toBeLessThan(gel.carbsG);
});

test("le débit horaire est le même partout", () => {
  // Deux secteurs de durées très différentes : seule la durée fait varier la
  // dose, jamais le terrain.
  const points = flatTrack(40, 6);
  const plan = nutritionPlan(
    points,
    [{ name: "AidStation", distanceM: 10_000 }],
    RUNNER,
    TARGETS,
    [gel],
  );

  for (const s of plan.legs) {
    expect(s.need.carbsG / (s.durationS / 3600)).toBeCloseTo(60, 9);
  }
});

test("la dépense monte avec le dénivelé, l'apport ne la couvre pas", () => {
  // 10 km, 500 m D+, en 1 h 30 — une allure de montée plausible. À 2 km/h on
  // mangerait effectivement plus qu'on ne brûle : l'écart entre apport et
  // dépense est une propriété des allures de course, pas une identité.
  const climbing: TimedPoint[] = [];
  for (let i = 0; i <= 1000; i++) {
    climbing.push({ lat: 0, lon: 0, d: i * 10, ele: i * 0.5, t: i * 5.4 });
  }

  const relief = nutritionPlan(climbing, [], RUNNER, TARGETS, [gel]);
  const flatRace = nutritionPlan(flatTrack(10, 1.5), [], RUNNER, TARGETS, [
    gel,
  ]);

  expect(relief.total.expenditureKcal).toBeGreaterThan(
    flatRace.total.expenditureKcal,
  );
  // On ne mange jamais sa dépense : le reste vient des graisses.
  expect(relief.total.carbsG * 4).toBeLessThan(relief.total.expenditureKcal);
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

test("l'eau claire complète la boisson", () => {
  const points = flatTrack(40, 5);

  const withDrink = nutritionPlan(points, [], RUNNER, TARGETS, [gel, drink]);
  const [s] = withDrink.legs;
  expect(s.plainWaterMl).toBeCloseTo(s.need.fluidMl - s.supply.fluidMl, 6);

  // Sur du solide seul, tout le liquide reste à boire.
  const solidOnly = nutritionPlan(points, [], RUNNER, TARGETS, [gel]);
  expect(solidOnly.legs[0].plainWaterMl).toBeCloseTo(
    solidOnly.legs[0].need.fluidMl,
    6,
  );
});

/**
 * `allocateSteps` comble par pas successifs tant que l'apport reste sous le
 * besoin. Une cible non finie ne se comble jamais : la boucle tournait sans
 * fin, et un gel se diagnostique plus mal qu'une exception.
 */
test("une cible non finie ne fait pas boucler le noyau", () => {
  const plan = nutritionPlan(
    flatTrack(10, 2),
    [],
    RUNNER,
    { ...TARGETS, carbsGH: Number.POSITIVE_INFINITY },
    [gel, drink],
  );

  expect(Number.isFinite(plan.total.carbsG)).toBe(true);
  for (const r of plan.legs[0].servings) {
    expect(Number.isFinite(r.units)).toBe(true);
  }
});

test("sans produit, le plan le dit au lieu de diviser par zéro", () => {
  const plan = nutritionPlan(flatTrack(10, 2), [], RUNNER, TARGETS, []);

  expect(plan.legs[0].servings).toEqual([]);
  expect(plan.total.carbsG).toBe(0);
  expect(plan.warnings[0]).toEqual({ code: "no-carb-product" });
});

/**
 * Les parts se lisent sur la liste passée par l'appelant. Un produit sans
 * glucides est écarté du calcul, mais il ne doit pas décaler les parts de ceux
 * qui le suivent.
 */
test("un produit sans glucides ne décale pas les parts", () => {
  const water: Product = {
    id: "eau-claire",
    brand: "—",
    name: "Eau claire",
    type: "drink",
    weightG: 0,
    energyKcal: 0,
    carbsG: 0,
    sodiumMg: 0,
    fluidMl: 500,
    multiTransportable: false,
    divisibleBy: 2,
  };

  // Deux solides : depuis le §6, les parts ne gouvernent plus le partage entre
  // boisson et solide — c'est l'hydratation qui commande le bidon.
  const plan = nutritionPlan(
    flatTrack(40, 5),
    [],
    RUNNER,
    TARGETS,
    [water, gel, baouwGel],
    [0, 0.9, 0.1],
  );

  const served = (id: string) =>
    plan.legs[0].servings.find((s) => s.product.id === id)?.units ?? 0;

  // 90 % des glucides sur le premier gel : il doit en apporter bien plus.
  expect(served(gel.id) * gel.carbsG).toBeGreaterThan(
    served(baouwGel.id) * baouwGel.carbsG,
  );
});
