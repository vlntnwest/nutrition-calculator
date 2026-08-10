import type { Coordinates, RawPoint, RoutePoint } from "./type";

const toRad = (value: number): number => (value * Math.PI) / 180;

export function haversine(a: Coordinates, b: Coordinates): number {
  const EARTH_RADIUS_M = 6_371_008.8; // Rayon de la Terre en mètres

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return EARTH_RADIUS_M * c;
}

export function withCumulativeDistance(points: RawPoint[]): RoutePoint[] {
  const result: RoutePoint[] = [];
  let cumulative = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) cumulative += haversine(points[i - 1], points[i]);
    result.push({ ...points[i], d: cumulative });
  }
  return result;
}
