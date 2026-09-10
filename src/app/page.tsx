import { HomeScreen } from "./_home/HomeScreen";
import { listOfficialRaces } from "./plans/officialRaces";

/**
 * Deux cartes, pas le catalogue : l'accueil est un écran d'import, les
 * courses officielles y sont une porte de plus, pas le sujet. Le reste se
 * voit sur `/plans/officiels`, où la tuile « Voir les plans officiels » mène.
 */
const A_L_ACCUEIL = 2;

/**
 * L'accueil ne lit aucune API de requête : sans consigne, Next le prérend au
 * build et fige les deux cartes à l'image de la base ce jour-là — une course
 * publiée ensuite n'y paraîtrait qu'au déploiement suivant.
 *
 * `connection()` le rendrait dynamique, comme la page Catalogue, mais c'est
 * la page d'entrée : elle se sert aujourd'hui en une centaine de
 * millisecondes sans toucher la base, contre quatre fois plus dès qu'elle
 * l'interroge. La revalidation garde les deux — servie depuis le cache,
 * refaite en fond. Publier une course est un geste rare ; cinq minutes
 * d'attente sont un prix acceptable, un redéploiement ne l'était pas.
 */
export const revalidate = 300;

export default async function Page() {
  return <HomeScreen races={await listOfficialRaces(A_L_ACCUEIL)} />;
}
