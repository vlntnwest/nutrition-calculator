import type { StoredPlan } from "@/app/plans/planInput";
import type { ResolvedPoint } from "@/core/type";
import {
  type Cadrage,
  cadrageOf,
  type Point,
  pointADistance,
  tuilesOf,
} from "./staticMap";
import { FINESSE, HAUTEUR_CARTE, LARGEUR_UTILE } from "./styles";
import { chargerTuiles, type TuileChargee } from "./tiles";

export type Carte = {
  cadrage: Cadrage;
  tuiles: TuileChargee[];
  points: Point[];
  bornes: { point: Point; label: string }[];
};

/**
 * Tout ce qu'il faut pour dessiner la carte : le cadrage, les tuiles
 * chargées, la trace et les bornes à marquer.
 *
 * Rend `null` plutôt que de lever quand il n'y a pas de trace : une feuille
 * sans fond de carte reste une feuille, et le roadbook en est la matière.
 */
export async function carteOf(
  plan: StoredPlan,
  points: ResolvedPoint[],
): Promise<Carte | null> {
  if (points.length < 2) return null;

  const cadrage = cadrageOf(points, {
    largeurPx: LARGEUR_UTILE * FINESSE,
    hauteurPx: HAUTEUR_CARTE * FINESSE,
  });

  return {
    cadrage,
    tuiles: await chargerTuiles(tuilesOf(cadrage)),
    points,
    bornes: bornesOf(points, plan.aidStations),
  };
}

/**
 * En deçà de cette distance, deux repères se recouvrent au lieu de se lire.
 * C'est le diamètre d'une pastille, rapporté à la longueur de la trace.
 */
const RECOUVREMENT = 0.004;

/**
 * Les repères à poser sur la carte : `D` au départ, le rang de chaque ravito
 * dans l'ordre de la course, `A` à l'arrivée. Les mêmes que la colonne
 * `repere` du tableau des temps de passage, sans quoi un numéro lu sur la
 * carte ne renverrait à aucune ligne.
 *
 * Sur une boucle, le départ et l'arrivée sont au même endroit et leurs deux
 * pastilles se superposeraient en un glyphe illisible. L'arrivée saute alors :
 * le coureur qui court une boucle sait où il la finit.
 */
export function bornesOf(
  /** La trace, dont seules les coordonnées et l'abscisse servent ici. */
  points: (Point & { d: number })[],
  aidStations: { distanceM: number }[],
): { point: Point; label: string }[] {
  const depart = points[0];
  const arrivee = points[points.length - 1];
  const totalM = arrivee.d - depart.d;
  const boucle =
    Math.hypot(arrivee.lat - depart.lat, arrivee.lon - depart.lon) <
    RECOUVREMENT;

  const ravitos = [...aidStations]
    .sort((a, b) => a.distanceM - b.distanceM)
    .flatMap((ravito, i) => {
      const point = pointADistance(points, ravito.distanceM);

      return point === null ? [] : [{ point, label: String(i + 1) }];
    });

  return [
    { point: depart, label: "D" },
    ...ravitos,
    ...(boucle || totalM <= 0 ? [] : [{ point: arrivee, label: "A" }]),
  ];
}
