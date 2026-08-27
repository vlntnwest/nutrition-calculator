const KEY = "plans";

/**
 * Les plans ouverts depuis ce navigateur.
 *
 * Un confort, pas une sauvegarde : l'identifiant d'accès est le seul droit
 * d'entrée, et le perdre perd le plan. Vider son navigateur perd la liste,
 * pas les plans — d'où le lien à garder ailleurs.
 */
export function storedPlans(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");

    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    // Entrée illisible : on repart d'une liste vide plutôt que de planter.
    return [];
  }
}

/** Retient un plan, le plus récent d'abord, sans doublon. */
export function rememberPlan(accessId: string): void {
  if (typeof window === "undefined") return;

  const kept = [accessId, ...storedPlans().filter((id) => id !== accessId)];
  window.localStorage.setItem(KEY, JSON.stringify(kept));
}

/** Oublie un plan — il a expiré, ou l'utilisateur le retire de sa liste. */
export function forgetPlan(accessId: string): void {
  if (typeof window === "undefined") return;

  const kept = storedPlans().filter((id) => id !== accessId);
  window.localStorage.setItem(KEY, JSON.stringify(kept));
}
