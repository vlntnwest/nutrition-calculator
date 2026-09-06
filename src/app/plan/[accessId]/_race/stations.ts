import type { LegOverride, NewAidStation } from "@/app/plans/planInput";
import { km, toNumber } from "@/format/number";

/**
 * Un ravito en cours de saisie.
 *
 * Le texte tapé, pas la valeur : repasser par un nombre à chaque frappe
 * effacerait le séparateur décimal, qu'on ne pourrait alors jamais entrer.
 * La conversion attend l'enregistrement.
 */
export type Row = {
  /**
   * Une identité de saisie, jamais écrite en base. Deux ravitos peuvent
   * partager un nom et changer de rang en cours de frappe : sans elle, retirer
   * le premier ferait hériter le second de son état à l'écran.
   */
  id: string;
  name: string;
  km: string;
  stopMin: string;
  eau: boolean;
  solide: boolean;
};

/** Le secteur le plus court que le calcul accepte, en mètres. */
export const MIN_LEG_M = 1000;

let compteur = 0;

/** Une identité neuve, propre à cette saisie. */
export function nouvelId(): string {
  compteur += 1;

  return `ravito-${compteur}`;
}

export function toRow(aid: NewAidStation): Row {
  return {
    id: nouvelId(),
    name: aid.name,
    km: String(aid.distanceM / 1000).replace(".", ","),
    stopMin: aid.stopS === undefined ? "" : String(Math.round(aid.stopS / 60)),
    eau: aid.providesLiquid ?? true,
    solide: aid.providesSolid ?? true,
  };
}

/** Un ravito neuf, posé à une abscisse lue sur le profil ou sur la carte. */
export function rowAt(positionM: number, rang: number): Row {
  return {
    id: nouvelId(),
    name: `Ravito ${rang}`,
    km: (Math.round(positionM) / 1000).toFixed(1).replace(".", ","),
    stopMin: "",
    eau: true,
    solide: true,
  };
}

/**
 * Les ravitos saisis, rangés sur l'abscisse, ou le premier reproche à faire.
 *
 * Le contrôle d'écartement se fait ici plutôt qu'au serveur : celui-ci refuse
 * en anglais et en mètres, ce qui n'aide personne devant un formulaire.
 */
export function toStations(
  lignes: Row[],
  totalM: number,
): NewAidStation[] | string {
  const stations: NewAidStation[] = [];

  for (const ligne of lignes) {
    const nom = ligne.name.trim();
    if (nom === "") return "Donnez un nom à chaque ravito.";

    const position = toNumber(ligne.km);
    if (position === undefined) {
      return `Ravito « ${nom} » : indiquez sa distance en kilomètres.`;
    }
    if (position <= 0 || position * 1000 >= totalM) {
      return `Ravito « ${nom} » : sa distance doit tomber sur la trace, entre 0 et ${km(totalM)} km.`;
    }

    const stop = toNumber(ligne.stopMin);
    if (ligne.stopMin.trim() !== "" && stop === undefined) {
      return `Ravito « ${nom} » : l'arrêt n'est pas un nombre de minutes.`;
    }

    stations.push({
      name: nom,
      distanceM: position * 1000,
      stopS: stop === undefined ? undefined : stop * 60,
      providesLiquid: ligne.eau,
      providesSolid: ligne.solide,
    });
  }

  stations.sort((a, b) => a.distanceM - b.distanceM);

  const bornes = [0, ...stations.map((s) => s.distanceM), totalM];
  for (let i = 1; i < bornes.length; i++) {
    if (bornes[i] - bornes[i - 1] < MIN_LEG_M) {
      return `Deux bornes se touchent, à ${km(bornes[i - 1])} km et ${km(bornes[i])} km. Il faut au moins ${km(MIN_LEG_M)} km entre le départ, chaque ravito et l'arrivée.`;
    }
  }

  return stations;
}

/**
 * Les consignes de secteur qui survivent à ce jeu de ravitos.
 *
 * Une consigne s'accroche à la borne qui clôt son secteur. Déplacer ou
 * retirer un ravito laisserait la sienne dans le vide, et le serveur
 * refuserait le plan entier plutôt que la consigne seule.
 */
export function survivingOverrides(
  overrides: LegOverride[],
  stations: NewAidStation[],
  totalM: number,
): LegOverride[] {
  const bornes = new Set([...stations.map((s) => s.distanceM), totalM]);

  return overrides.filter((o) => bornes.has(o.endPositionM));
}

/** L'indice du point de trace le plus proche d'une abscisse donnée. */
export function pointIndexAt(
  points: { d: number }[],
  positionM: number,
): number {
  let meilleur = 0;
  let ecart = Number.POSITIVE_INFINITY;

  for (const [i, point] of points.entries()) {
    const distance = Math.abs(point.d - positionM);
    if (distance < ecart) {
      ecart = distance;
      meilleur = i;
    }
  }

  return meilleur;
}
