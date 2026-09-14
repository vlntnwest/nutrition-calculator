import { sum } from "./sum.ts";
import type {
  Fill,
  Flask,
  Imposed,
  Leg,
  Product,
  Runner,
  Serving,
} from "./type.ts";

/** Ce que le coureur porte en tout. `null` si rien n'a été déclaré. */
export function carryCapacityMl(runner: Runner): number | null {
  if (runner.flasks.length === 0) return null;

  return runner.flasks.reduce((s, f) => s + f.volumeMl, 0);
}

/** Ce qu'il peut préparer en boisson : les flasques non réservées à l'eau. */
export function drinkCapacityMl(runner: Runner): number | null {
  if (runner.flasks.length === 0) return null;

  return runner.flasks
    .filter((f) => !f.onlyWater)
    .reduce((s, f) => s + f.volumeMl, 0);
}

/**
 * Les remplissages tels qu'on les impose.
 *
 * Ce qu'ils ne portent pas ressort en `refillMl`, au même endroit que dans
 * `fillSpans` : à l'ouverture de la portée. On ne verse qu'à cette
 * ouverture-là — une consigne posée plus loin dans la portée se refuse.
 */
export function imposeFills(
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
export function fillSpans(
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
