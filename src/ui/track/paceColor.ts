/**
 * L'échelle d'allure du profil : rouge en haut du cadre, vert au passage de
 * l'allure moyenne, bleu en bas.
 *
 * C'est la seule rampe continue du carnet, et la seule entorse à sa palette.
 * Elle est empruntée telle quelle au PacePro des montres de course, où les
 * coureurs la lisent déjà : lui substituer une échelle de gris propre au
 * produit demanderait de la réapprendre, pour dire la même chose moins vite.
 *
 * Elle se pose sur la **hauteur du cadre**, jamais sur le tronçon : le trait
 * prend la couleur de l'endroit où il passe, et une contremarche se dégrade
 * donc sur toute sa longueur. C'est ce qui la distingue d'une échelle par
 * palier, et c'est aussi ce qui la rend redondante avec l'axe gradué qu'elle
 * longe, donc jamais seule à porter l'information.
 */
const PACE_STOPS = [
  { at: 0, color: "#2b7bd6" },
  { at: 0.25, color: "#3fa9c9" },
  { at: 0.5, color: "#3f9e4d" },
  { at: 0.7, color: "#e0a91b" },
  { at: 0.85, color: "#e2721f" },
  { at: 1, color: "#cf3b1f" },
] as const;

/** Le dégradé de la légende, du plus lent au plus rapide. */
export const PACE_GRADIENT = `linear-gradient(90deg, ${PACE_STOPS.map(
  (stop) => `${stop.color} ${stop.at * 100}%`,
).join(", ")})`;

/**
 * Les arrêts du dégradé une fois posés sur le cadre, du plus lent au plus
 * rapide.
 *
 * Les deux moitiés s'étirent séparément pour que le vert tombe pile sur
 * l'allure moyenne : elle n'est presque jamais à mi-hauteur, la queue lente
 * étant plus longue que la rapide, et un dégradé régulier mettrait donc le
 * vert là où rien ne se passe.
 *
 * @param meanAt Où tombe l'allure moyenne, de 0 pour le bas du cadre à 1 pour
 *   le haut.
 */
export function paceGradientStops(
  meanAt: number,
): { offset: number; color: string }[] {
  // Un vert collé à une bordure ferait un dégradé dégénéré, deux arrêts au
  // même endroit : on lui garde un cheveu de place de chaque côté.
  const pivot = clamp(meanAt, 0.02, 0.98);

  return PACE_STOPS.map((stop) => ({
    offset:
      stop.at <= 0.5
        ? (stop.at / 0.5) * pivot
        : pivot + ((stop.at - 0.5) / 0.5) * (1 - pivot),
    color: stop.color,
  }));
}

/** La couleur de la rampe à `t`, de 0 pour le plus lent à 1 pour le plus rapide. */
export function paceRampColor(t: number): string {
  const value = clamp(Number.isFinite(t) ? t : 0.5, 0, 1);
  const next = PACE_STOPS.findIndex((stop) => value <= stop.at);

  if (next <= 0) return PACE_STOPS[0].color;

  const low = PACE_STOPS[next - 1];
  const high = PACE_STOPS[next];

  return mix(low.color, high.color, (value - low.at) / (high.at - low.at));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** `part` de 0 rend `from`, de 1 rend `to`. Les deux sont des `#rrggbb`. */
function mix(from: string, to: string, part: number): string {
  const a = channels(from);
  const b = channels(to);
  const canal = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * part)
      .toString(16)
      .padStart(2, "0");

  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
