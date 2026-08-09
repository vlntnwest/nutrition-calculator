import simplify from "simplify-js";
import type { ResolvedPoint } from "./type";

export type TypeTroncon = "montee" | "descente" | "roulant";

export type Troncon = {
  debutM: number;
  finM: number;
  longueurM: number;
  denivelePositifM: number;
  deniveleNegatifM: number;
  penteMoyenne: number;
  type: TypeTroncon;
};

type Marque = { x: number; y: number; i: number };

/**
 * Découpe la trace en tronçons de pente homogène.
 *
 * @param toleranceM Écart maximal du profil à la corde du tronçon.
 * @param longueurMinM Plancher sous lequel un tronçon est fusionné.
 * @param penteRoulanteMax Pente en deçà de laquelle un tronçon est « roulant ».
 */
export function decoupeParPente(
  points: ResolvedPoint[],
  toleranceM = 30,
  longueurMinM = 300,
  penteRoulanteMax = 0.02,
): Troncon[] {
  if (points.length < 2) return [];

  const profil: Marque[] = points.map((p, i) => ({ x: p.d, y: p.ele, i }));
  const bornes = (simplify(profil, toleranceM, true) as Marque[]).map(
    (m) => m.i,
  );

  fusionneLesCourts(points, bornes, longueurMinM);

  const troncons: Troncon[] = [];
  for (let i = 0; i < bornes.length - 1; i++) {
    troncons.push(
      construis(points, bornes[i], bornes[i + 1], penteRoulanteMax),
    );
  }

  return troncons;
}

function pente(points: ResolvedPoint[], a: number, b: number): number {
  const distance = points[b].d - points[a].d;

  return distance > 0 ? (points[b].ele - points[a].ele) / distance : 0;
}

/**
 * Douglas-Peucker n'a aucune notion de longueur : il ne voit que l'écart à la
 * corde, et sort des tronçons de quelques dizaines de mètres. On absorbe le
 * plus court dans celui de ses voisins dont la pente est la plus proche, et on
 * recommence — fusionner le plus court d'abord rend le résultat indépendant de
 * l'ordre de parcours.
 */
function fusionneLesCourts(
  points: ResolvedPoint[],
  bornes: number[],
  longueurMinM: number,
): void {
  while (bornes.length > 2) {
    let k = -1;
    let plusCourt = longueurMinM;

    for (let i = 0; i < bornes.length - 1; i++) {
      const longueur = points[bornes[i + 1]].d - points[bornes[i]].d;
      if (longueur < plusCourt) {
        plusCourt = longueur;
        k = i;
      }
    }

    if (k === -1) return;

    bornes.splice(borneASupprimer(points, bornes, k), 1);
  }
}

/** Quelle borne retirer pour fusionner le tronçon `k` avec son meilleur voisin. */
function borneASupprimer(
  points: ResolvedPoint[],
  bornes: number[],
  k: number,
): number {
  if (k === 0) return k + 1;
  if (k === bornes.length - 2) return k;

  const courante = pente(points, bornes[k], bornes[k + 1]);
  const gauche = Math.abs(pente(points, bornes[k - 1], bornes[k]) - courante);
  const droite = Math.abs(
    pente(points, bornes[k + 1], bornes[k + 2]) - courante,
  );

  return gauche <= droite ? k : k + 1;
}

function construis(
  points: ResolvedPoint[],
  a: number,
  b: number,
  penteRoulanteMax: number,
): Troncon {
  let denivelePositifM = 0;
  let deniveleNegatifM = 0;

  for (let i = a + 1; i <= b; i++) {
    const delta = points[i].ele - points[i - 1].ele;
    if (delta > 0) denivelePositifM += delta;
    else deniveleNegatifM -= delta;
  }

  const penteMoyenne = pente(points, a, b);

  return {
    debutM: points[a].d,
    finM: points[b].d,
    longueurM: points[b].d - points[a].d,
    denivelePositifM,
    deniveleNegatifM,
    penteMoyenne,
    type: classe(penteMoyenne, penteRoulanteMax),
  };
}

function classe(penteMoyenne: number, penteRoulanteMax: number): TypeTroncon {
  if (penteMoyenne > penteRoulanteMax) return "montee";
  if (penteMoyenne < -penteRoulanteMax) return "descente";

  return "roulant";
}
