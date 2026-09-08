/**
 * Lit un nombre, la virgule valant le point : un clavier français ne propose
 * pas autre chose, et `Number("9,8")` rend `NaN`.
 */
export function toNumber(texte: string): number | undefined {
  const propre = texte.trim().replace(",", ".");
  if (propre === "") return undefined;

  const valeur = Number(propre);

  return Number.isFinite(valeur) ? valeur : undefined;
}

/** `28350` → `28,4`. La distance se lit au dixième de kilomètre. */
export function km(metres: number): string {
  return (metres / 1000).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** `1314` → `1 314`. Une mesure entière, espace insécable compris. */
export function entier(valeur: number): string {
  return Math.round(valeur).toLocaleString("fr-FR");
}

/** `0.5` → `0,5`, `2` → `2`. Les quantités se coupent en deux, pas plus. */
export function quantite(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

/** `4556` → `1 h 15`, `540` → `9 min`. */
export function duree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.round((secondes % 3600) / 60);

  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Un écart à un besoin, signé et arrondi : `-12.4` → `−12 g`. Rend une chaîne
 * vide sous le seuil, où l'écart n'apprend rien — un gramme de glucides, mais
 * plus pour le sodium ou l'eau, mesurés par centaines.
 */
export function ecart(valeur: number, unite = "g", seuil = 1): string {
  if (Math.abs(valeur) < seuil) return "";

  return `${valeur > 0 ? "+" : "−"}${Math.round(Math.abs(valeur))} ${unite}`;
}
