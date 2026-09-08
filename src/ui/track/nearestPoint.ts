/**
 * L'indice du point le plus proche d'une coordonnée, à vol d'oiseau en
 * lat/lon — suffisant pour retrouver « où sur le tracé » on survole la
 * carte à l'échelle d'une course, pas pour naviguer précisément.
 */
export function nearestPointIndex(
  points: { lat: number; lon: number }[],
  lat: number,
  lon: number,
): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const dLat = points[i].lat - lat;
    const dLon = points[i].lon - lon;
    const dist = dLat * dLat + dLon * dLon;

    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return best;
}
