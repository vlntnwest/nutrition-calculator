import type { Flask, Targets } from "@/core/type";

/**
 * Ce que les cibles horaires demandent sur toute la course, et si les
 * flasques y suffisent.
 *
 * Une cible par heure ne dit rien de l'effort qu'elle représente : c'est la
 * multiplication par la durée qui rend le réglage jugeable, et la comparaison
 * aux contenants qui dit s'il faudra s'arrêter pour remplir.
 */
export type Synthese = {
  carbsG: number;
  fluidMl: number;
  /** La contenance totale emportée. Zéro sans flasque déclarée. */
  carryMl: number;
  /**
   * Combien de fois il faudra remplir en course, en partant flasques
   * pleines. Nul quand rien n'est emporté : la question ne se pose pas.
   */
  remplissages: number | null;
};

export function synthetiser(
  targets: Targets,
  flasks: Flask[],
  targetTimeS: number,
): Synthese {
  const heures = targetTimeS / 3600;
  const fluidMl = targets.fluidMlH * heures;
  const carryMl = flasks.reduce((total, f) => total + f.volumeMl, 0);

  return {
    carbsG: targets.carbsGH * heures,
    fluidMl,
    carryMl,
    remplissages:
      carryMl === 0 ? null : Math.max(0, Math.ceil(fluidMl / carryMl) - 1),
  };
}
