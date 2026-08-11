import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { elevationGain } from "./elevation";
import { parseGpx } from "./parseGpx";
import { prepareTrack, SETTINGS } from "./pipeline";
import { simplifyPoints } from "./simplify";

test("sauve le sommet", () => {
  const points = [
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 0.001, lon: 0, ele: 150, d: 100 },
    { lat: 0.002, lon: 0, ele: 200, d: 200 },
    { lat: 0.003, lon: 0, ele: 150, d: 300 },
    { lat: 0.004, lon: 0, ele: 100, d: 400 },
  ];
  const result = simplifyPoints(points);
  expect(result).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 0.002, lon: 0, ele: 200, d: 200 },
    { lat: 0.004, lon: 0, ele: 100, d: 400 },
  ]);
});

/**
 * La simplification est une compression **visuelle** : elle jette 75 à 93 %
 * des points, mais le profil qu'elle laisse doit rester celui du terrain.
 * Le D+ recalculé sur sa sortie est la mesure de cette fidélité — c'est aussi
 * ce qui justifie de ne jamais s'en servir pour calculer, seulement pour
 * dessiner. Voir docs/noyau-de-calcul.md.
 */
test.each([
  "andlau.gpx",
  "saverne.gpx",
  "uthk.gpx",
])("%s — le D+ de la trace simplifiée reste à 2 %% du plein", (file) => {
  const xml = readFileSync(
    new URL(`./fixtures/references/${file}`, import.meta.url),
    "utf8",
  );
  const full = prepareTrack(parseGpx(xml).points);
  const simplified = simplifyPoints(
    full,
    SETTINGS.simplifyMapDeg,
    SETTINGS.simplifyProfileM,
  );

  const gain = elevationGain(full, SETTINGS.thresholdM);
  const simplifiedGain = elevationGain(simplified, SETTINGS.thresholdM);

  expect(simplified.length).toBeLessThan(full.length / 4);
  expect(Math.abs(simplifiedGain / gain - 1)).toBeLessThan(0.02);
});

test("sauve le virage", () => {
  const points = [
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 0, lon: 0.001, ele: 100, d: 100 },
    { lat: 0, lon: 0.002, ele: 100, d: 200 },
    { lat: 0.001, lon: 0.002, ele: 100, d: 300 },
    { lat: 0.002, lon: 0.002, ele: 100, d: 400 },
  ];
  const result = simplifyPoints(points);
  expect(result).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 0, lon: 0.002, ele: 100, d: 200 },
    { lat: 0.002, lon: 0.002, ele: 100, d: 400 },
  ]);
});
