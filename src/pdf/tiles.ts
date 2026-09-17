import { type Tuile, tuileUrl } from "./staticMap";

/**
 * Le chargement des tuiles du fond de carte, côté serveur.
 *
 * Jusqu'ici c'était le navigateur du coureur qui demandait les tuiles, et qui
 * signait donc la requête. Depuis que la feuille se fabrique côté serveur,
 * c'est à nous de le faire : la politique d'usage d'OpenStreetMap veut qu'une
 * application se nomme et laisse un moyen de la joindre, faute de quoi elle
 * peut être bloquée. Voir `docs/pdf-du-roadbook.md`, section 2.1.
 */
const AGENT =
  "nutrition-calculator/0.1 (+https://github.com/vlntnwest/nutrition-calculator)";

/**
 * Un mois. Un fond de carte ne bouge pas d'une semaine à l'autre, et deux
 * plans sur la même course demandent les mêmes carrés : les redemander à
 * chaque feuille serait du gaspillage sur une ressource offerte.
 */
const FRAICHEUR_S = 30 * 24 * 3600;

export type TuileChargee = Tuile & { data: Buffer };

export async function chargerTuiles(tuiles: Tuile[]): Promise<TuileChargee[]> {
  const chargees = await Promise.all(tuiles.map(charger));

  // Une tuile manquante laisse un carré blanc sous la trace. Elle ne fait pas
  // échouer la feuille : le tracé, le profil et les tableaux se lisent sans
  // le fond, et une carte trouée vaut mieux qu'un téléchargement refusé.
  return chargees.filter((tuile) => tuile !== null);
}

async function charger(tuile: Tuile): Promise<TuileChargee | null> {
  try {
    const reponse = await fetch(tuileUrl(tuile), {
      headers: { "User-Agent": AGENT },
      next: { revalidate: FRAICHEUR_S },
    });

    if (!reponse.ok) return null;

    return { ...tuile, data: Buffer.from(await reponse.arrayBuffer()) };
  } catch {
    return null;
  }
}
