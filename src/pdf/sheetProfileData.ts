import { racePaceBand } from "@/app/plan/[accessId]/roadbook/racePaceBand";
import type { StoredPlan } from "@/app/plans/planInput";
import type { Roadbook } from "@/app/plans/roadbook";
import type { ProfilePoint } from "@/core/type";
import { type Cadre, figureOf, type ProfileFigure } from "./profile";

/**
 * Le profil de la feuille, tel que l'écran Course le montre.
 *
 * La bande d'allure vient de `racePaceBand`, celle-là même que l'écran
 * Roadbook trace : la figure de l'écran Course, jamais la moyenne par secteur.
 * Voir `docs/pdf-du-roadbook.md`, 2.5.
 *
 * Le relief, lui, se trace sur les points simplifiés : `ElevationChart` dit
 * pourquoi, et un aplat par segment sur quinze mille points coûterait autant
 * ici qu'à l'écran.
 */
export function profilOf({
  plan,
  roadbook,
  points,
  profile,
  cadre,
}: {
  plan: StoredPlan;
  roadbook: Roadbook;
  points: ProfilePoint[];
  profile: ProfilePoint[];
  cadre: Cadre;
}): ProfileFigure {
  return figureOf({
    points,
    band: racePaceBand(plan, roadbook, profile),
    // Les mêmes repères que la carte et que le tableau : le dernier secteur
    // s'achève à l'arrivée, qu'aucun ravito ne borne.
    bornes: roadbook.legs.flatMap((leg, i) =>
      leg.endPositionM === null || i === roadbook.legs.length - 1
        ? []
        : [{ positionM: leg.endPositionM, repere: String(i + 1) }],
    ),
    cadre,
  });
}
