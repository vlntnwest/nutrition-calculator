/**
 * Les repères publiés, lus par le calcul comme par l'interface.
 *
 * Ils vivent à part pour que `warnings` les lise sans dépendre du module
 * qui l'appelle.
 */

/** Paliers proposés dans l'interface. Aucune valeur n'est imposée. */
export const CARB_TIERS = [30, 60, 90];

/** Au-delà, le glucose seul sature son transporteur intestinal. */
export const CARBS_SINGLE_SOURCE_MAX_G_H = 60;

/** Repère de tolérance digestive au-delà duquel on alerte, sans interdire. */
export const CARBS_GUIDE_G_H = 90;

/**
 * L'écart toléré entre ce qu'on sert et ce qu'on vise, en glucides.
 *
 * Une boisson concentrée traîne ses glucides avec le liquide : viser bas en
 * glucides tout en buvant beaucoup dépasse la cible sans qu'on l'ait demandé,
 * et le solide n'a plus sa place. On tolère le rangement — les produits sont
 * discrets, un gel de trop dépasse de quelques pour cent — pas le structurel.
 */
export const CARBS_OVERSHOOT_MAX = 1.3;

/**
 * Repère d'hydratation. Boire plus qu'on ne transpire dilue le sodium sanguin
 * — c'est l'hyponatrémie d'effort. On alerte, on n'écrête pas : changer une
 * valeur saisie sans le dire est pire que de ne rien faire.
 */
export const FLUID_GUIDE_ML_H = 800;
