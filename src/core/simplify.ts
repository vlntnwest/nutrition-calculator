import simplify from "simplify-js";
import type { ResolvedPoint } from "./type";

type Marque = { x: number; y: number; i: number };

export function simplifyPoints(
  points: ResolvedPoint[],
  toleranceDeg = 7.5e-5, // carte, en degrés  (~8 m)
  toleranceEleM = 1.5, // profil, en mètres d'altitude
): ResolvedPoint[] {
  if (points.length <= 3) return points.map((p) => ({ ...p }));

  const coords: Marque[] = points.map((p, i) => ({
    x: p.lon,
    y: p.lat,
    i,
  }));
  const profile: Marque[] = points.map((p, i) => ({
    x: p.d,
    y: p.ele,
    i,
  }));

  const coordsSimplifies = simplify(coords, toleranceDeg, true) as Marque[];
  const profilSimplifies = simplify(profile, toleranceEleM, true) as Marque[];

  const indexes = new Set<number>();
  for (const m of coordsSimplifies) indexes.add(m.i);
  for (const m of profilSimplifies) indexes.add(m.i);

  return points.filter((_, i) => indexes.has(i)).map((p) => ({ ...p }));
}
