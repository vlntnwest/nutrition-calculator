import type { StoredPlan } from "@/app/plans/planInput";
import type { Roadbook } from "@/app/plans/roadbook";
import { pacingIssue } from "@/core/distribute";
import type { FixedSpan, ProfilePoint } from "@/core/type";
import type { PaceBand } from "@/ui/track/chartTypes";
import { paceBand, paceSegments } from "../_race/pacing";

/** Les durées imposées du plan, relues sur les secteurs qu'elles bornent. */
function fixedSpansOf(roadbook: Roadbook): FixedSpan[] {
  const spans: FixedSpan[] = [];
  let startM = 0;

  for (const leg of roadbook.legs) {
    const endM = leg.endPositionM ?? roadbook.totalM;
    if (leg.imposedDurationS !== null) {
      spans.push({ startM, endM, durationS: leg.imposedDurationS });
    }
    startM = endM;
  }

  return spans;
}

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
 * Les entrées du calcul se relisent ici telles qu'il les a eues : les réglages
 * d'allure viennent du plan, qu'une retouche du chrono ou d'un curseur
 * condamnerait (`survives`) ; les durées imposées viennent des secteurs
 * eux-mêmes. Les omettre peignait sur le profil une allure que le tableau
 * juste en dessous contredisait.
 */
export function racePaceBand(
  plan: StoredPlan,
  roadbook: Roadbook,
  profile: ProfilePoint[],
): PaceBand | null {
  // ADR 010 : les arrêts sont déjà hors des durées de secteur, leur somme est
  // donc le temps de mouvement, celui sur lequel l'allure se répartit.
  const mouvementS = roadbook.legs.reduce((t, leg) => t + leg.durationS, 0);
  const segments = paceSegments(profile);
  const pacing = {
    climbEffort: plan.settings.climbEffort ?? 0,
    split: plan.settings.paceSplit ?? 0,
  };

  try {
    return paceBand(
      profile,
      segments,
      mouvementS,
      pacing,
      fixedSpansOf(roadbook),
    );
  } catch (error) {
    if (pacingIssue(error) === null) throw error;

    // Cette somme de durées n'est pas à la seconde près le chrono que le
    // calcul a réparti : un écart d'arrondi peut rendre infaisable une
    // consigne qui passait. Mieux vaut une bande sans consigne qu'un écran
    // Roadbook qui ne s'affiche plus.
    return paceBand(profile, segments, mouvementS, pacing);
  }
}
