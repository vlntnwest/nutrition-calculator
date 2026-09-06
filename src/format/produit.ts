/**
 * Le vocabulaire des formats, en français.
 *
 * La base stocke le libellé du noyau (`gel`, `bar`, `drink`), qui sert de clé
 * naturelle et n'a pas à être traduit dans le seed. La traduction vit ici, au
 * seul endroit qui parle au coureur.
 */
const FORMATS: Record<string, string> = {
  gel: "gel",
  bar: "barre",
  drink: "boisson",
  puree: "purée",
  waffle: "gaufre",
  chew: "pâte",
  capsule: "capsule",
};

export function formatFr(label: string): string {
  return FORMATS[label] ?? label;
}

/** `drink` → `boissons`. Le pluriel d'un filtre ou d'un compte. */
export function formatPluriel(label: string): string {
  const mot = formatFr(label);

  return mot.endsWith("s") ? mot : `${mot}s`;
}

/**
 * Ce qu'un produit devient une fois entamé. Un gel se finit, une barre se
 * casse : c'est ce qui décide du pas de la quantité au roadbook.
 */
export function coupeFr(divisibleBy: number): string {
  return divisibleBy === 2
    ? "se coupe en deux"
    : "ne se coupe pas, la dose est l'unité";
}

/**
 * Le nom commercial tel qu'il s'affiche.
 *
 * Le catalogue sépare un parfum du nom du produit tantôt par un tiret
 * cadratin, tantôt par un trait d'union entouré d'espaces. `docs/voix.md`
 * bannit le premier de tout texte lu par un coureur, et les instantanés déjà
 * figés dans un plan enregistré gardent la forme d'origine : la
 * normalisation se fait donc aussi ici, pas seulement dans le seed.
 */
export function nomProduit(nom: string): string {
  return nom.replace(/\s+[—–-]\s+/g, ", ");
}
