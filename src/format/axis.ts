/**
 * Des valeurs rondes à poser sur un axe : autant que possible proches de
 * `cible`, jamais hors de l'intervalle.
 *
 * Un axe gradué sur des nombres arbitraires ne se lit pas — « 137, 326, 515 »
 * demande un calcul à chaque coup d'œil, « 200, 400, 600 » ne demande rien.
 *
 * L'écran et la feuille PDF la partagent : c'est la même grille des deux
 * côtés, et deux découpages voisins se verraient en posant l'un sur l'autre.
 */
export function graduations(min: number, max: number, cible: number): number[] {
  if (!(max > min)) return [min];

  const pas = arrondi((max - min) / Math.max(cible, 1));
  const valeurs: number[] = [];

  for (
    let valeur = Math.ceil(min / pas) * pas;
    valeur <= max + pas * 1e-9;
    valeur += pas
  ) {
    // La somme flottante dérive : on la ramène sur le pas à chaque tour.
    valeurs.push(Math.round(valeur / pas) * pas);
  }

  return valeurs.length >= 2 ? valeurs : [min, max];
}

/** Le pas rond immédiatement utile : 1, 2, 2,5 ou 5 fois une puissance de dix. */
function arrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const reste = brut / puissance;
  const echelon = reste <= 1 ? 1 : reste <= 2 ? 2 : reste <= 2.5 ? 2.5 : 5;

  return echelon * puissance;
}
