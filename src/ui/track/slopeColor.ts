/**
 * L'échelle d'inclinaison façon OpenRunner : cinq paliers de pente plutôt
 * qu'un dégradé continu — un dégradé se lit comme une décoration, cinq
 * paliers se lisent comme une mesure. Dans la famille du seul accent brûlé
 * du carnet (`--accent` à `--accent-dark`), pas dans le jaune-vert-rouge
 * d'origine : la teinte reste celle du reste de la fiche.
 *
 * Ne remplace jamais un intitulé : « la couleur ne peut jamais porter seule
 * une information » (PRODUCT.md, accessibilité) — la légende à côté du
 * graphique porte les mêmes seuils en texte.
 */
export const SLOPE_BUCKETS = [
  { maxPercent: 5, color: "#fbe7d9", label: "≤ 5 %" },
  { maxPercent: 7, color: "#eeb27a", label: "≤ 7 %" },
  { maxPercent: 10, color: "#c2410c", label: "≤ 10 %" },
  { maxPercent: 15, color: "#7a2c08", label: "≤ 15 %" },
  { maxPercent: Number.POSITIVE_INFINITY, color: "#3a1306", label: "> 15 %" },
] as const;

/** La couleur du palier pour une pente donnée — le signe n'y change rien. */
export function slopeColor(gradePercent: number): string {
  const pente = Math.abs(gradePercent);

  // `SLOPE_BUCKETS` finit par `Infinity` : `find` trouve toujours un palier,
  // le dernier sert de secours pour que le type reste `string`.
  const palier = SLOPE_BUCKETS.find((bucket) => pente <= bucket.maxPercent);

  return (palier ?? SLOPE_BUCKETS[SLOPE_BUCKETS.length - 1]).color;
}

/**
 * La pente entre deux points du profil, en pourcentage. `undefined` sur une
 * distance nulle — deux points au même endroit ne définissent pas de pente,
 * et `Infinity` casserait la couleur qui en dépend.
 */
export function gradePercent(
  a: { d: number; ele: number },
  b: { d: number; ele: number },
): number | undefined {
  const distance = b.d - a.d;

  return distance === 0 ? undefined : ((b.ele - a.ele) / distance) * 100;
}
