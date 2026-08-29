import type { Roadbook } from "@/app/plans/getRoadbook";
import { CARBS_OVERSHOOT_MAX } from "@/core/nutrition";

/** `-12.4` → `−12`, `+3.2` → `+3`. Signé : l'écart peut être négatif. */
export function ecart(marginG: number): string {
  if (Math.abs(marginG) < 1) return "";
  const signe = marginG > 0 ? "+" : "−";

  return ` (${signe}${Math.round(Math.abs(marginG))} g)`;
}

/** `4556` → `1 h 15`. */
export function duree(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);

  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function borne(leg: Roadbook["legs"][number], totalM: number): string {
  return leg.endPositionM === null
    ? `arrivée (${(totalM / 1000).toFixed(1)} km)`
    : `${(leg.endPositionM / 1000).toFixed(1)} km`;
}

/**
 * L'écart mérite-t-il d'être signalé ?
 *
 * Seulement vers le haut : un secteur sous son besoin propre est prévu par
 * l'ADR 007, les solides se comptant sur la course puis se plaçant. Le seuil
 * est celui du contrôle global — mesuré, un plan calculé reste sous 1,1 quand
 * une retouche peut tripler.
 */
export function excessif(supplyG: number, needG: number): boolean {
  return needG > 0 && supplyG > needG * CARBS_OVERSHOOT_MAX;
}
