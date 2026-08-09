const PENTE_MAX = 0.45;
const COUT_MONTEE = 2.5;
const DESCENTE_OPTIMALE = 0.072;
const DESCENTE_GAIN = 0.074;
const DESCENTE_PENALITE_MAX = 2;

/**
 * Le coût relatif d'un tronçon, 1 valant le plat.
 *
 * @param pente Fraction, écrêtée à ±45 %. Un `NaN` se propage.
 * @param intensiteMontee De 0 à 1 : plus elle monte, moins les côtes
 *   ralentissent. Sans effet sur la descente.
 */
export function paceModel(pente: number, intensiteMontee = 0): number {
  const p = Math.min(Math.max(pente, -PENTE_MAX), PENTE_MAX);

  if (p > 0) return 1 + (1 - intensiteMontee) * COUT_MONTEE * p;

  // Parabole en U : creux à `t = 1`, retour sur le plat à `t = 2`.
  const t = -p / DESCENTE_OPTIMALE;

  return Math.min(1 - DESCENTE_GAIN * t * (2 - t), DESCENTE_PENALITE_MAX);
}

/**
 * La dérive d'allure entre le départ et l'arrivée.
 *
 * @param progression Fraction de distance parcourue, de 0 à 1.
 * @param split Positif pour un positive split. `0,10` vaut ~10 % plus lent au
 *   dernier kilomètre qu'au premier.
 */
export function paceDrift(progression: number, split: number): number {
  const x = Math.min(Math.max(progression, 0), 1);
  const s = Math.min(Math.max(split, -1), 1);

  return 1 + s * (x - 0.5);
}
