import type { PacingIssue } from "@/core/type";
import { duree } from "@/format/number";

/**
 * Le refus lisible d'un plan dont le chrono ne tient plus, en français.
 *
 * Le noyau lève une erreur porteuse de ses chiffres (`pacingError`) plutôt
 * que d'écrire une phrase — c'est ici, et nulle part ailleurs, qu'elle en
 * devient une, sur le même principe que `warningText` pour les remarques.
 */
export function pacingIssueText(issue: PacingIssue): string {
  switch (issue.code) {
    case "stops-above-target":
      return `Les arrêts aux ravitos (${duree(issue.stopS)}) valent déjà autant que le chrono visé (${duree(issue.targetTimeS)}) : il ne reste rien à courir. Réduisez les arrêts, ou allongez le chrono.`;

    case "fixed-above-target":
      return `Les durées imposées sur les secteurs (${duree(issue.fixedS)}) dépassent à elles seules le temps de mouvement disponible (${duree(issue.targetTimeS)}). Retirez une consigne, ou allongez le chrono.`;

    case "fixed-miss-target":
      return `Toutes les portions du parcours portent une durée imposée, mais leur somme (${duree(issue.fixedS)}) ne tombe pas sur le temps de mouvement disponible (${duree(issue.targetTimeS)}). Retirez au moins une consigne pour laisser une marge libre.`;
  }
}
