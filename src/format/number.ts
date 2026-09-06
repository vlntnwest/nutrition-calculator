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
 * L'écart aux glucides visés, signé et arrondi : `-12.4` → `−12 g`. Rend une
 * chaîne vide sous le gramme, où l'écart n'apprend rien.
 */
export function ecart(grammes: number): string {
  if (Math.abs(grammes) < 1) return "";

  return `${grammes > 0 ? "+" : "−"}${Math.round(Math.abs(grammes))} g`;
}
