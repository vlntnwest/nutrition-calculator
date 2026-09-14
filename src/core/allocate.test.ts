import fc from "fast-check";
import { expect, test } from "vitest";
import { SAMPLE_PRODUCTS, sampleProductById } from "@/fixtures/sampleProducts";
import {
  baouwBar,
  drink,
  flatTrack,
  gel,
  RUNNER,
  TARGETS,
} from "./fixtures/plan";
import { nutritionPlan } from "./nutrition";
import type { AidStation, Leg, Product } from "./type";

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
      fc.uniqueArray(fc.constantFrom(...SAMPLE_PRODUCTS), {
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

/**
 * Le défaut du plan UTHK : quatre produits divisibles par deux, et une
 * demi-dose de chacun dans le même secteur. Arithmétiquement juste,
 * inapplicable — on ne coupe pas quatre emballages à un ravito.
 *
 * Une fraction par secteur reste utile : c'est l'ajustement final, celui qui
 * évite de dépasser la cible d'une unité entière.
 */
test("un secteur ne porte qu'une seule demi-dose au plus", () => {
  const quatre = [
    sampleProductById("naak-waffle-citron"),
    sampleProductById("naak-bar-ultra"),
    sampleProductById("naak-drink-ultra"),
    sampleProductById("naak-drink-salted-soup"),
  ] as Product[];

  const plan = nutritionPlan(
    flatTrack(108, 12.5),
    [
      { name: "R1", distanceM: 22600 },
      { name: "R2", distanceM: 39800 },
      { name: "R3", distanceM: 63000 },
      { name: "R4", distanceM: 82200 },
    ],
    { massKg: 77, flasks: [{ volumeMl: 500, onlyWater: false }] },
    TARGETS,
    quatre,
  );

  for (const [i, leg] of plan.legs.entries()) {
    const fractions = leg.servings.filter((s) => s.units % 1 !== 0);

    expect(
      fractions.map((s) => `${s.units} × ${s.product.name}`),
      `secteur ${i + 1}`,
    ).toHaveLength(fractions.length > 0 ? 1 : 0);
  }
});

/**
 * Le critère, plus fort qu'un seuil chiffré : un écart qui reste doit être
 * **irréductible**. On ne cherche pas zéro partout — les produits sont
 * discrets — mais aucun déplacement d'une ration d'un secteur à l'autre ne
 * doit pouvoir rapprocher les deux de leur cible. S'il en existe un, c'est un
 * oubli, pas un arrondi.
 */
test("aucun déplacement ne peut encore améliorer le plan", () => {
  const plan = nutritionPlan(
    flatTrack(108, 12.5),
    [22600, 39800, 63000, 82200].map((distanceM, i) => ({
      name: `R${i + 1}`,
      distanceM,
    })),
    { massKg: 77, flasks: [] },
    TARGETS,
    ["naak-waffle-citron", "naak-bar-ultra", "naak-drink-ultra"].map(
      (c) => sampleProductById(c) as Product,
    ),
  );

  /** Les unités par produit, telles que le secteur les porte. */
  const held = plan.legs.map((leg) => {
    const m = new Map<string, number>();
    for (const s of leg.servings) m.set(s.product.id, s.units);

    return m;
  });
  // Dédoublonné : le même produit revient dans plusieurs secteurs.
  const solids = [
    ...new Map(
      plan.legs
        .flatMap((l) => l.servings.map((s) => s.product))
        .filter((p) => p.fluidMl === 0 && p.divisibleBy > 1)
        .map((p) => [p.id, p] as const),
    ).values(),
  ];

  /**
   * Combien de fractions le secteur porterait avec `delta` unités de `p`.
   *
   * On pose la clé avant de compter : un produit que le secteur ne porte pas
   * encore est absent de la table, et la moitié qu'on lui ajoute passerait
   * inaperçue.
   */
  const fractions = (l: number, id: string, delta: number) => {
    const apres = new Map(held[l]);
    apres.set(id, (apres.get(id) ?? 0) + delta);

    return [...apres.values()].filter((units) => units % 1 !== 0).length;
  };

  const ameliorations: string[] = [];

  for (const p of solids) {
    const pas = p.carbsG / p.divisibleBy;

    for (let a = 0; a < plan.legs.length; a++) {
      if ((held[a].get(p.id) ?? 0) < 1 / p.divisibleBy) continue;

      for (let b = 0; b < plan.legs.length; b++) {
        if (a === b) continue;

        const avant =
          Math.abs(plan.legs[a].marginG) + Math.abs(plan.legs[b].marginG);
        const apres =
          Math.abs(plan.legs[a].marginG - pas) +
          Math.abs(plan.legs[b].marginG + pas);
        if (avant - apres <= 0.1) continue;

        // Le déplacement doit rester licite : une fraction par secteur.
        // Passer de 1,5 à 2 en **retire** une, ce n'est donc pas bloquant.
        if (fractions(a, p.id, -1 / p.divisibleBy) > 1) continue;
        if (fractions(b, p.id, 1 / p.divisibleBy) > 1) continue;

        ameliorations.push(
          `${p.name} : s${a + 1} (${plan.legs[a].marginG.toFixed(1)} g) → ` +
            `s${b + 1} (${plan.legs[b].marginG.toFixed(1)} g)`,
        );
      }
    }
  }

  expect(ameliorations).toEqual([]);
});
