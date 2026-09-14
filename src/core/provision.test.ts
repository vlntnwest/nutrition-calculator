import { expect, test } from "vitest";
import { sampleProductById } from "@/fixtures/sampleProducts";
import {
  baouwBar,
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
import { nutritionPlan } from "./nutrition";
import type { AidStation, Product, Targets } from "./type";

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

test("une boisson qui n'entre nulle part laisse tout le liquide en eau claire", () => {
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

test("la boisson d'une portée tient dans ce qu'on prépare une fois", () => {
  // La contenance ne se renouvelle qu'aux points d'eau. Sur une portée qui en
  // franchit un sec, la préparer secteur par secteur la comptait deux fois :
  // 500 mL de flasque à boisson devenaient 1 000 mL de poudre dosée.
  const plan = nutritionPlan(
    flatTrack(40, 4),
    [WATER_STOP, DRY_STOP],
    CARRIER,
    TARGETS,
    [gel, drink],
  );

  const porteeMl = [1, 2].reduce((t, l) => t + plan.legs[l].supply.fluidMl, 0);

  expect(porteeMl).toBeLessThanOrEqual(500);
});

/**
 * On ne mélange pas deux poudres. Le cas se produit sans flasque déclarée :
 * plus rien ne borne le liquide, et deux sachets tiennent dans un secteur
 * long. Une flasque ne porte qu'une chose, un secteur non plus.
 */
test("un secteur ne porte qu'une seule boisson", () => {
  const deux = [
    sampleProductById("naak-drink-ultra"),
    sampleProductById("naak-drink-salted-soup"),
    sampleProductById("naak-bar-ultra"),
  ] as Product[];

  const plan = nutritionPlan(
    flatTrack(108, 12.5),
    [
      { name: "R1", distanceM: 22600 },
      { name: "R2", distanceM: 63000 },
    ],
    // Aucune flasque : c'est le cas qui déclenchait le mélange.
    { massKg: 77, flasks: [] },
    TARGETS,
    deux,
  );

  for (const [i, leg] of plan.legs.entries()) {
    const boissons = leg.servings.filter((s) => s.product.fluidMl > 0);

    expect(
      boissons.map((s) => s.product.name),
      `secteur ${i + 1}`,
    ).toHaveLength(boissons.length > 0 ? 1 : 0);
  }

  // Les deux boissons servent quand même sur la course : n'en garder qu'une
  // reviendrait à ignorer un produit que le coureur a choisi.
  const servies = new Set(
    plan.legs.flatMap((l) =>
      l.servings.filter((s) => s.product.fluidMl > 0).map((s) => s.product.id),
    ),
  );
  expect(servies.size).toBe(2);
});

/**
 * Une cible imposée à un secteur : « celui-ci mérite plus ».
 *
 * Elle se range sur le ravito qui **clôt** le secteur, comme la durée
 * imposée, et à part pour l'arrivée qu'aucun ravito ne ferme. C'est une
 * entrée, pas un ajustement du calcul : elle survit à chaque régénération.
 */
test("une cible imposée à un secteur relève son besoin", () => {
  const points = flatTrack(40, 5);
  const stations: AidStation[] = [{ name: "R1", distanceM: 20000 }];

  const nominal = nutritionPlan(points, stations, RUNNER, TARGETS, [gel]);
  const force = nutritionPlan(
    points,
    [{ ...stations[0], legTargets: { carbsGH: 90 } }],
    RUNNER,
    TARGETS,
    [gel],
  );

  // Le premier secteur vise 90 g/h au lieu de 60 : son besoin monte de moitié.
  expect(force.legs[0].need.carbsG).toBeCloseTo(
    nominal.legs[0].need.carbsG * 1.5,
    6,
  );
  // Le second n'a pas bougé, la consigne ne vise que son secteur.
  expect(force.legs[1].need.carbsG).toBeCloseTo(nominal.legs[1].need.carbsG, 6);
  // Et le sac suit : on emporte davantage.
  expect(force.total.carbsG).toBeGreaterThan(nominal.total.carbsG);
});

test("l'arrivée se règle à part, aucun ravito ne la ferme", () => {
  const points = flatTrack(40, 5);
  const stations: AidStation[] = [{ name: "R1", distanceM: 20000 }];

  const nominal = nutritionPlan(points, stations, RUNNER, TARGETS, [gel]);
  const force = nutritionPlan(points, stations, RUNNER, TARGETS, [gel], {
    finishTargets: { fluidMlH: 900 },
  });

  expect(force.legs[1].need.fluidMl).toBeCloseTo(
    (nominal.legs[1].need.fluidMl * 900) / TARGETS.fluidMlH,
    6,
  );
  expect(force.legs[0].need.fluidMl).toBeCloseTo(
    nominal.legs[0].need.fluidMl,
    6,
  );
});

test("des rations imposées remplacent la répartition", () => {
  const impose = nutritionPlan(flatTrack(20, 3), [], RUNNER, TARGETS, [gel], {
    imposed: { servings: [[{ productId: gel.id, units: 3 }]] },
  });

  // Sans ravito, un seul secteur : la consigne tient en un tableau.
  expect(impose.legs).toHaveLength(1);
  expect(impose.legs[0].servings).toEqual([{ product: gel, units: 3 }]);
  expect(impose.legs[0].supply.carbsG).toBeCloseTo(3 * gel.carbsG);
  expect(impose.legs[0].marginG).toBeCloseTo(
    3 * gel.carbsG - impose.legs[0].need.carbsG,
  );
});

test("une ration imposée se range sur le pas du produit", () => {
  const impose = nutritionPlan(
    flatTrack(20, 3),
    [],
    RUNNER,
    TARGETS,
    [gel, baouwBar],
    {
      imposed: {
        servings: [
          [
            { productId: gel.id, units: 1.4 },
            { productId: baouwBar.id, units: 1.4 },
          ],
        ],
      },
    },
  );

  // Le gel ne se coupe pas, la barre se coupe en deux.
  expect(impose.legs[0].servings).toEqual([
    { product: gel, units: 1 },
    { product: baouwBar, units: 1.5 },
  ]);
});

test("une ration imposée sous le demi-pas disparaît", () => {
  const impose = nutritionPlan(flatTrack(20, 3), [], RUNNER, TARGETS, [gel], {
    imposed: { servings: [[{ productId: gel.id, units: 0.3 }]] },
  });

  expect(impose.legs[0].servings).toEqual([]);
});
