import simplify from "simplify-js";
import type { Mark, ResolvedPoint, Segment, SegmentType } from "./type";

/**
 * Découpe la trace en tronçons de pente homogène.
 *
 * @param toleranceM Écart maximal du profil à la corde du tronçon.
 * @param minLengthM Plancher sous lequel un tronçon est fusionné.
 * @param flatMax Pente en deçà de laquelle un tronçon est « roulant ».
 */
export function splitBySlope(
  points: ResolvedPoint[],
  toleranceM = 30,
  minLengthM = 300,
  flatMax = 0.02,
): Segment[] {
  if (points.length < 2) return [];

  const profile: Mark[] = points.map((p, i) => ({ x: p.d, y: p.ele, i }));
  const bounds = (simplify(profile, toleranceM, true) as Mark[]).map(
    (m) => m.i,
  );

  mergeShortSegments(points, bounds, minLengthM);

  const segments: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segments.push(buildSegment(points, bounds[i], bounds[i + 1], flatMax));
  }

  return segments;
}

function slope(points: ResolvedPoint[], a: number, b: number): number {
  const distance = points[b].d - points[a].d;

  return distance > 0 ? (points[b].ele - points[a].ele) / distance : 0;
}

/**
 * Douglas-Peucker n'a aucune notion de longueur : il ne voit que l'écart à la
 * corde, et sort des tronçons de quelques dizaines de mètres. On absorbe le
 * plus court dans celui de ses voisins dont la pente est la plus proche, et on
 * recommence — fusionner le plus court d'abord rend le résultat indépendant de
 * l'ordre de parcours.
 */
function mergeShortSegments(
  points: ResolvedPoint[],
  bounds: number[],
  minLengthM: number,
): void {
  while (bounds.length > 2) {
    let k = -1;
    let shortest = minLengthM;

    for (let i = 0; i < bounds.length - 1; i++) {
      const length = points[bounds[i + 1]].d - points[bounds[i]].d;
      if (length < shortest) {
        shortest = length;
        k = i;
      }
    }

    if (k === -1) return;

    bounds.splice(boundaryToDrop(points, bounds, k), 1);
  }
}

/** Quelle borne retirer pour fusionner le tronçon `k` avec son meilleur voisin. */
function boundaryToDrop(
  points: ResolvedPoint[],
  bounds: number[],
  k: number,
): number {
  if (k === 0) return k + 1;
  if (k === bounds.length - 2) return k;

  const current = slope(points, bounds[k], bounds[k + 1]);
  const left = Math.abs(slope(points, bounds[k - 1], bounds[k]) - current);
  const right = Math.abs(slope(points, bounds[k + 1], bounds[k + 2]) - current);

  return left <= right ? k : k + 1;
}

function buildSegment(
  points: ResolvedPoint[],
  a: number,
  b: number,
  flatMax: number,
): Segment {
  let ascentM = 0;
  let descentM = 0;

  for (let i = a + 1; i <= b; i++) {
    const delta = points[i].ele - points[i - 1].ele;
    if (delta > 0) ascentM += delta;
    else descentM -= delta;
  }

  const meanSlope = slope(points, a, b);

  return {
    startM: points[a].d,
    endM: points[b].d,
    lengthM: points[b].d - points[a].d,
    ascentM,
    descentM,
    meanSlope,
    type: classify(meanSlope, flatMax),
  };
}

function classify(meanSlope: number, flatMax: number): SegmentType {
  if (meanSlope > flatMax) return "climb";
  if (meanSlope < -flatMax) return "descent";

  return "flat";
}
