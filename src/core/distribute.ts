// Extensions .ts explicites : imports de valeurs, que `node` résout
// nativement dans les scripts. Voir pipeline.ts.
import { paceDrift, paceModel } from "./pace.ts";
import type { ResolvedPoint } from "./type.ts";

export type ProfilCoureur = {
  intensiteMontee: number;
  split: number;
};

export type TimedPoint = ResolvedPoint & { t: number };

/**
 * Répartit un temps visé sur la trace. `t` est le temps cumulé depuis le
 * départ, comme `d` est la distance cumulée : toute sortie — par tronçon, par
 * kilomètre, à un ravitaillement — s'en déduit par soustraction.
 *
 * @param tempsViseS Temps total visé, en secondes.
 */
export function distributeTime(
  points: ResolvedPoint[],
  tempsViseS: number,
  profil: ProfilCoureur,
): TimedPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], t: 0 }];

  const distanceTotale = points[points.length - 1].d - points[0].d;
  const poids = new Array<number>(points.length);
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const longueur = points[i].d - points[i - 1].d;

    // Deux points confondus ne coûtent rien. Sans ce garde, la pente vaut
    // `Infinity` — que `paceModel` écrête — mais un `0 / 0` donnerait `NaN`,
    // qui contaminerait le total et donc toute la trace.
    if (longueur <= 0) {
      poids[i] = 0;
      continue;
    }

    const pente = (points[i].ele - points[i - 1].ele) / longueur;
    const milieu =
      distanceTotale > 0
        ? (points[i].d + points[i - 1].d) / 2 / distanceTotale
        : 0;

    poids[i] =
      longueur *
      paceModel(pente, profil.intensiteMontee) *
      paceDrift(milieu, profil.split);
    total += poids[i];
  }

  const resultat: TimedPoint[] = [{ ...points[0], t: 0 }];

  // Une trace de longueur nulle n'a rien à répartir : tout le monde à zéro,
  // sauf l'arrivée qui reçoit le temps visé juste en dessous.
  const allure = total > 0 ? tempsViseS / total : 0;
  let t = 0;

  for (let i = 1; i < points.length; i++) {
    t += poids[i] * allure;
    resultat.push({ ...points[i], t });
  }

  // L'accumulation flottante rate la cible de quelques microsecondes. On écrit
  // l'arrivée plutôt que de l'accumuler, pour que `t` du dernier point vaille
  // exactement le temps visé — même correctif que le dernier point de
  // `resample`.
  resultat[resultat.length - 1].t = tempsViseS;

  return resultat;
}
