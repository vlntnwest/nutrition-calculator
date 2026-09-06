import type { Roadbook } from "@/app/plans/getRoadbook";
import { CARBS_OVERSHOOT_MAX } from "@/core/nutrition";
import { km } from "@/format/number";

/** Là où le secteur s'achève, nommé quand un ravito le clôt. */
export function bound(leg: Roadbook["legs"][number], totalM: number): string {
  return leg.endPositionM === null
    ? `arrivée, ${km(totalM)} km`
    : `${km(leg.endPositionM)} km`;
}

/**
 * L'écart mérite-t-il d'être signalé ?
 *
 * Seulement vers le haut : un secteur sous son besoin propre est prévu par
 * l'ADR 007, les solides se comptant sur la course puis se plaçant. Le seuil
 * est celui du contrôle global — mesuré, un plan calculé reste sous 1,1 quand
 * une retouche peut tripler.
 */
export function excessive(supplyG: number, needG: number): boolean {
  return needG > 0 && supplyG > needG * CARBS_OVERSHOOT_MAX;
}

/** L'abscisse où le secteur commence : la borne qui clôt le précédent. */
export function startOf(legs: Roadbook["legs"], index: number): number {
  return index === 0 ? 0 : (legs[index - 1].endPositionM ?? 0);
}

/**
 * L'allure moyenne d'un secteur, en secondes par kilomètre. C'est du temps de
 * mouvement : les arrêts au ravito ne sont pas dedans.
 */
export function legPaceSPerKm(
  legs: Roadbook["legs"],
  index: number,
  totalM: number,
): number | null {
  const leg = legs[index];
  const distanceM = (leg.endPositionM ?? totalM) - startOf(legs, index);

  return distanceM > 0 && leg.durationS > 0
    ? leg.durationS / (distanceM / 1000)
    : null;
}
