import type { StoredPlan } from "@/app/plans/planInput";
import type { Roadbook } from "@/app/plans/roadbook";
import type { ProfilePoint } from "@/core/type";
import type { PaceBand } from "@/ui/track/chartTypes";
import { paceBand, paceSegments } from "../_race/pacing";

/**
 * La bande d'allure d'un plan calculé, telle que l'écran Course la montre :
 * sur le **profil pleine résolution** et par tronçon de pente homogène.
 *
 * L'écran Roadbook et la feuille PDF la lisent tous deux ici, et pour la même
 * raison : `legPaceBand` ne donne que la moyenne par secteur, qui aplatit une
 * bosse de trois kilomètres dans un secteur de quinze. Deux dérivations
 * séparées finiraient par diverger, et le papier ne montrerait plus l'écran.
 * Voir `docs/pdf-du-roadbook.md`, 2.5.
 *
 * Se calcule côté serveur, jamais dans le navigateur : le profil pèse jusqu'à
 * un mégaoctet et demi, la bande quelques centaines de tronçons.
 *
 * Les réglages d'allure sont ceux du plan sans risque de décalage : une
 * retouche du chrono ou d'un curseur condamne le calcul (`survives`), donc un
 * roadbook qui existe a été calculé sur les réglages qu'on relit ici.
 */
export function racePaceBand(
  plan: StoredPlan,
  roadbook: Roadbook,
  profile: ProfilePoint[],
): PaceBand | null {
  // ADR 010 : les arrêts sont déjà hors des durées de secteur, leur somme est
  // donc le temps de mouvement, celui sur lequel l'allure se répartit.
  const mouvementS = roadbook.legs.reduce((t, leg) => t + leg.durationS, 0);

  return paceBand(profile, paceSegments(profile), mouvementS, {
    climbEffort: plan.settings.climbEffort ?? 0,
    split: plan.settings.paceSplit ?? 0,
  });
}
