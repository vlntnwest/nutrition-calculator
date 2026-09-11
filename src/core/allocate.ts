import type { Product } from "./type.ts";

type Weighted = { product: Product; weight: number };

/** Une charge, avant conversion en unités : voir `Product.divisibleBy`. */
export type Loaded = { product: Product; steps: number };

/**
 * En combien de pas se compte une unité. Tout le calcul travaille en pas
 * entiers et ne divise qu'à la toute fin : c'est ce qui permet à la méthode du
 * plus fort reste de s'appliquer telle quelle à un produit sécable.
 */
export function stepsOf(product: Product): number {
  const n = Math.floor(product.divisibleBy);

  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Le partage d'une quantité entre des produits, selon leurs parts.
 *
 * Des parts toutes nulles ne veulent pas dire « rien à personne » : c'est
 * l'absence de consigne, donc le partage à parts égales.
 */
export function share(items: Weighted[], amount: number): number[] {
  const totalWeight = items.reduce((s, k) => s + k.weight, 0);

  return items.map((k) =>
    totalWeight > 0 ? (amount * k.weight) / totalWeight : amount / items.length,
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
export function allocateSteps(
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
export function apportion(total: number, weights: number[]): number[] {
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
export function consolidate(loaded: Loaded[][], needsG: number[]): void {
  // Une boisson n'a rien à regrouper ici : sa quantité est commandée par
  // l'hydratation du secteur, pas par ses glucides.
  const divisible = (i: number) =>
    stepsOf(loaded[0][i].product) > 1 && loaded[0][i].product.fluidMl === 0;
  const fraction = (l: number, i: number) =>
    loaded[l][i].steps % stepsOf(loaded[l][i].product) !== 0;
  const fractionalCount = (l: number) =>
    loaded[l].reduce(
      (n, _, i) => n + (divisible(i) && fraction(l, i) ? 1 : 0),
      0,
    );
  // Ce qu'il reste à couvrir, recalculé à chaque échange : c'est lui qui
  // désigne le receveur, pas une estimation faite avant la répartition — un
  // secteur déjà bien servi continuerait sinon de recevoir.
  const shortfall = (l: number) =>
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
      const n = fractionalCount(l);
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
        .sort(
          (a, b) =>
            fractionalCount(b) - fractionalCount(a) ||
            shortfall(b) - shortfall(a),
        )[0];
      if (partenaire === undefined) continue;

      const [recoit, cede] =
        shortfall(charge) >= shortfall(partenaire)
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
export function rebalance(loaded: Loaded[][], needsG: number[]): void {
  const divisible = (i: number) =>
    stepsOf(loaded[0][i].product) > 1 && loaded[0][i].product.fluidMl === 0;
  const fractions = (l: number, sauf = -1, delta = 0) =>
    loaded[l].reduce((n, x, i) => {
      const steps = x.steps + (i === sauf ? delta : 0);
      const impair = divisible(i) && steps % stepsOf(x.product) !== 0;

      return n + (impair ? 1 : 0);
    }, 0);
  const margin = (l: number, sauf = -1, delta = 0) =>
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

          const avant = Math.abs(margin(a)) + Math.abs(margin(b));
          const apres = Math.abs(margin(a, i, -1)) + Math.abs(margin(b, i, 1));
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
