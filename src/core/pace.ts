const MAX_SLOPE = 0.45;
const CLIMB_COST = 2.5;
const DESCENT_OPTIMUM = 0.072;
const DESCENT_GAIN = 0.074;
const DESCENT_PENALTY_MAX = 2;

/**
 * Le coût relatif d'un tronçon, 1 valant le plat.
 *
 * @param pente Fraction, écrêtée à ±45 %. Un `NaN` se propage.
 * @param intensiteMontee De 0 à 1 : plus elle monte, moins les côtes
 *   ralentissent. Sans effet sur la descente.
 */
export function paceModel(slope: number, climbIntensity = 0): number {
  const p = Math.min(Math.max(slope, -MAX_SLOPE), MAX_SLOPE);

  if (p > 0) return 1 + (1 - climbIntensity) * CLIMB_COST * p;

  // Parabole en U : creux à `t = 1`, retour sur le plat à `t = 2`.
  const t = -p / DESCENT_OPTIMUM;

  return Math.min(1 - DESCENT_GAIN * t * (2 - t), DESCENT_PENALTY_MAX);
}

/** Minetti 2002, coefficients a0…a5 du coût de transport en J/kg/m. */
const MINETTI = [3.6, 19.5, 46.3, -43.3, -30.4, 155.4];

/**
 * Le coût énergétique de la course, en joules par kilogramme et par mètre.
 *
 * Ce n'est **pas** `paceModel`. Le temps et l'énergie ne suivent pas la même
 * courbe : une descente raide se descend lentement, en freinant, mais elle ne
 * coûte presque rien métaboliquement — minimum vers −20 %.
 */
export function energyCost(slope: number): number {
  const p = Math.min(Math.max(slope, -MAX_SLOPE), MAX_SLOPE);

  let cost = 0;
  for (let i = MINETTI.length - 1; i >= 0; i--) cost = cost * p + MINETTI[i];

  return cost;
}

/**
 * La dérive d'allure entre le départ et l'arrivée.
 *
 * @param progression Fraction de distance parcourue, de 0 à 1.
 * @param split Positif pour un positive split. `0,10` vaut ~10 % plus lent au
 *   dernier kilomètre qu'au premier.
 */
export function paceDrift(progress: number, split: number): number {
  const x = Math.min(Math.max(progress, 0), 1);
  const s = Math.min(Math.max(split, -1), 1);

  return 1 + s * (x - 0.5);
}
