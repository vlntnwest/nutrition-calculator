import simplify from "simplify-js";
import type { Mark, ResolvedPoint } from "./type";

export function simplifyPoints(
  points: ResolvedPoint[],
  toleranceDeg = 7.5e-5, // carte, en degrés  (~8 m)
  toleranceEleM = 1.5, // profil, en mètres d'altitude
): ResolvedPoint[] {
  if (points.length <= 3) return points.map((p) => ({ ...p }));

  const coords: Mark[] = points.map((p, i) => ({
    x: p.lon,
    y: p.lat,
    i,
  }));
  const profile: Mark[] = points.map((p, i) => ({
    x: p.d,
    y: p.ele,
    i,
  }));

  const simplifiedCoords = simplify(coords, toleranceDeg, true) as Mark[];
  const simplifiedProfile = simplify(profile, toleranceEleM, true) as Mark[];

  const kept = new Set<number>();
  for (const m of simplifiedCoords) kept.add(m.i);
  for (const m of simplifiedProfile) kept.add(m.i);

  return points.filter((_, i) => kept.has(i)).map((p) => ({ ...p }));
}
