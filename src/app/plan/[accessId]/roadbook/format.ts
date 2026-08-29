import type { Roadbook } from "@/app/plans/getRoadbook";

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
