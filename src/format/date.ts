/**
 * Une date de dossier : `10 sept. 2026`. Le mois s'abrège, l'année reste,
 * l'heure ne s'écrit jamais — une sauvegarde à la minute près n'apprend rien
 * sur un plan qu'on rouvre à des semaines d'intervalle.
 */
export function shortDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
