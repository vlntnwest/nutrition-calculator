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

/**
 * Ce qui se verse dans une flasque.
 *
 * Une flasque contient une boisson, et rien d'autre : une poudre à diluer, un
 * liquide à couper. Un gel, une barre, une gaufre se mangent — les proposer
 * au remplissage laissait poser une barre dans cinq cents millilitres, et le
 * calcul comptait alors ses glucides comme bus. Une capsule ne s'y verse pas
 * davantage : elle s'avale avec l'eau, elle ne la prépare pas.
 *
 * La liste nomme ce qui passe plutôt que ce qui ne passe pas, sur les
 * libellés du noyau (`src/format/produit.ts`) : un format nouveau ne se
 * retrouve pas versable par oubli.
 */
const VERSABLES = new Set(["drink"]);

export function estVersable(formatLabel: string): boolean {
  return VERSABLES.has(formatLabel);
}
