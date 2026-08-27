import { suggestedTargets } from "@/core/nutrition";
import type { Runner, Targets } from "@/core/type";

type Stored = {
  targetCarbsGH: number | null;
  targetFluidMlH: number | null;
  targetSodiumMgL: number | null;
};

/**
 * Les cibles sur lesquelles le plan est calculé : celles qui ont été saisies,
 * ou celles que le noyau suggère.
 *
 * Une seule décision, partagée par le calcul et par sa relecture : le
 * roadbook doit montrer l'écart à ce qui a réellement été visé, pas à autre
 * chose.
 */
export function resolveTargets(
  stored: Stored,
  runner: Runner,
  durationS: number,
): Targets {
  if (
    stored.targetCarbsGH === null ||
    stored.targetFluidMlH === null ||
    stored.targetSodiumMgL === null
  ) {
    return suggestedTargets(runner, durationS);
  }

  return {
    carbsGH: stored.targetCarbsGH,
    fluidMlH: stored.targetFluidMlH,
    sodiumMgL: stored.targetSodiumMgL,
  };
}
