import type { ResolvedPoint } from "./type";

/**
 * Une fenêtre nulle, négative ou `NaN` saute le filtre — ADR 006, qui veut que
 * le passage par un filtre soit explicite et non le résultat d'une arithmétique
 * de bord. Sans ce garde, `half` devient négatif ou `NaN`, la fenêtre glissante
 * se vide, et la médiane lit un point qui n'existe pas.
 *
 * `Infinity` passe : la fenêtre couvre alors toute la trace, ce qui a un sens.
 */
function skips(windowM: number): boolean {
  return !(windowM > 0);
}

export function medianFilter(
  points: ResolvedPoint[],
  windowM = 30,
): ResolvedPoint[] {
  if (points.length < 2 || skips(windowM)) {
    return points.map((p) => ({ ...p }));
  }

  const step = points[1].d - points[0].d;
  const nbPoints = Math.floor(windowM / step);
  const half = Math.floor(nbPoints / 2);

  const result: ResolvedPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);

    const segment = points.slice(start, end + 1);
    segment.sort((a, b) => a.ele - b.ele);

    const median = Math.floor(segment.length / 2);

    let value: number;
    if (segment.length % 2 !== 0) {
      value = segment[median].ele;
    } else {
      value = (segment[median - 1].ele + segment[median].ele) / 2;
    }
    result.push({ ...points[i], ele: value });
  }

  return result;
}

export function meanFilter(
  points: ResolvedPoint[],
  windowM = 50,
): ResolvedPoint[] {
  if (points.length < 2 || skips(windowM)) {
    return points.map((p) => ({ ...p }));
  }

  const step = points[1].d - points[0].d;
  const nbPoints = Math.floor(windowM / step);
  const half = Math.floor(nbPoints / 2);

  const result: ResolvedPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);

    const segment = points.slice(start, end + 1);
    const sum = segment.reduce((acc, p) => acc + p.ele, 0);
    const mean = sum / segment.length;
    result.push({ ...points[i], ele: mean });
  }

  return result;
}

export function smooth(
  points: ResolvedPoint[],
  medianM = 30,
  meanM = 0,
): ResolvedPoint[] {
  const filtered = medianFilter(points, medianM);
  return meanM > 0 ? meanFilter(filtered, meanM) : filtered;
}
