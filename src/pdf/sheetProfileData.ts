import { paceBand, paceSegments } from "@/app/plan/[accessId]/_race/pacing";
import type { StoredPlan } from "@/app/plans/planInput";
import type { Roadbook } from "@/app/plans/roadbook";
import type { ProfilePoint } from "@/core/type";
import { type Cadre, figureOf, type ProfileFigure } from "./profile";

/**
 * Le profil de la feuille, tel que l'écran Course le montre.
 *
 * La bande d'allure vient de `_race/pacing`, sur le **profil pleine
 * résolution** et par tronçon de pente homogène. Pas de `legPaceBand`, qui
 * donne la moyenne par secteur : ce n'est pas la même figure, et c'est celle
 * de l'écran Course qui a été retenue. Voir `docs/pdf-du-roadbook.md`, 2.5.
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
  // ADR 010 : les arrêts sont déjà hors des durées de secteur, leur somme est
  // donc le temps de mouvement, celui sur lequel l'allure se répartit.
  const mouvementS = roadbook.legs.reduce((t, leg) => t + leg.durationS, 0);

  return figureOf({
    points,
    band: paceBand(profile, paceSegments(profile), mouvementS, {
      climbEffort: plan.settings.climbEffort ?? 0,
      split: plan.settings.paceSplit ?? 0,
    }),
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
