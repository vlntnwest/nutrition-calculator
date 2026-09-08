import { expect, test } from "vitest";
import { nearestPointIndex } from "./nearestPoint";

const points = [
  { lat: 48.58, lon: 7.75 },
  { lat: 48.6, lon: 7.76 },
  { lat: 48.62, lon: 7.77 },
];

test.each([
  [48.58, 7.75, 0],
  [48.62, 7.77, 2],
  // Ni pile sur un point, ni au-delà : le plus proche l'emporte.
  [48.605, 7.762, 1],
  // Bien au-delà du dernier point, il reste tout de même le plus proche.
  [49, 8, 2],
])("nearestPointIndex(points, %o, %o) → %o", (lat, lon, attendu) => {
  expect(nearestPointIndex(points, lat, lon)).toBe(attendu);
});
