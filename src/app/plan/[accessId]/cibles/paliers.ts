import {
  CARBS_GUIDE_G_H,
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
} from "@/core/guides";

/**
 * Une valeur proposée pour une cible horaire, et ce qu'elle vaut.
 *
 * La mention n'est pas une aide de rédaction : c'est le seuil publié, écrit
 * là où le choix se fait. « Les seuils sont sourcés et les fourchettes
 * visibles » ne tient pas si la fourchette vit dans une légende à côté.
 */
export type Palier = { valeur: number; mention?: string };

/**
 * Les valeurs d'une échelle, du plus bas au plus haut, mentions comprises.
 *
 * Une valeur déjà enregistrée qui ne tombe pas sur un cran de l'échelle est
 * ajoutée à sa place : un plan écrit avant que le pas ne change garde sa
 * valeur, et la liste ne peut pas se retrouver sans rien de sélectionné.
 */
export function echelle(
  min: number,
  max: number,
  pas: number,
  mentions: Record<number, string>,
  courante?: number,
): Palier[] {
  const valeurs = new Set<number>();

  for (let v = min; v <= max; v += pas) valeurs.add(v);
  if (courante !== undefined) valeurs.add(courante);

  return [...valeurs]
    .sort((a, b) => a - b)
    .map((valeur) => ({ valeur, mention: mentions[valeur] }));
}

/**
 * Les glucides par heure.
 *
 * Deux crans portent une mention, et deux seulement : celui au-delà duquel un
 * seul type de sucre sature son transporteur, et le haut de la fourchette
 * publiée. Ce qui se passe au-dessus est déjà dit par les remarques du calcul,
 * sous la liste — le répéter sur trente crans ne ferait que du bruit.
 */
export function paliersGlucides(courante: number): Palier[] {
  return echelle(
    0,
    120,
    5,
    {
      [CARBS_SINGLE_SOURCE_MAX_G_H]: "limite d'un seul type de sucre",
      [CARBS_GUIDE_G_H]: "haut de la fourchette publiée",
    },
    courante,
  );
}

/**
 * La boisson par heure, au pas de 50 mL.
 *
 * Le pas est celui de la décision, pas celui de la mesure : personne ne règle
 * sa boisson à vingt-cinq millilitres près sur une heure de course, et une
 * liste deux fois plus longue se parcourt deux fois moins bien.
 */
export function paliersBoisson(courante: number): Palier[] {
  return echelle(
    100,
    1200,
    50,
    { [FLUID_GUIDE_ML_H]: "repère d'hydratation" },
    courante,
  );
}

/**
 * Le sodium de la boisson préparée, par litre.
 *
 * Aucune mention : `docs/sources.md` ne publie pas de seuil de concentration,
 * et en inventer un le ferait passer pour sourcé.
 */
export function paliersSodium(courante: number): Palier[] {
  return echelle(0, 1600, 50, {}, courante);
}
