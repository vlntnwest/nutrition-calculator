import { expect, test } from "vitest";
import { PACE_GRADIENT, paceGradientStops, paceRampColor } from "./paceColor";

const BLEU = "#2b7bd6";
const VERT = "#3f9e4d";
const ROUGE = "#cf3b1f";

test("les bornes de la rampe, et rien au-delà", () => {
  expect(paceRampColor(0)).toBe(BLEU);
  expect(paceRampColor(0.5)).toBe(VERT);
  expect(paceRampColor(1)).toBe(ROUGE);
  expect(paceRampColor(-3)).toBe(BLEU);
  expect(paceRampColor(9)).toBe(ROUGE);
  expect(paceRampColor(Number.NaN)).toBe(VERT);
});

test("la rampe est continue entre deux bornes", () => {
  // Le quart tombe pile sur le cyan, le huitième à mi-chemin du bleu.
  expect(paceRampColor(0.25)).toBe("#3fa9c9");
  expect(paceRampColor(0.125)).toBe("#3592d0");
});

/**
 * Le point du dégradé en deux moitiés : le vert doit tomber sur l'allure
 * moyenne où qu'elle soit dans le cadre, et chaque moitié aller jusqu'au bout.
 */
test("le vert se pose sur la moyenne, pas à mi-hauteur", () => {
  const stops = paceGradientStops(0.3);

  expect(stops[0]).toEqual({ offset: 0, color: BLEU });
  expect(stops[2]).toEqual({ offset: 0.3, color: VERT });
  expect(stops[stops.length - 1]).toEqual({ offset: 1, color: ROUGE });
  // La moitié froide est comprimée dans les trois premiers dixièmes, la
  // chaude étalée sur les sept autres.
  expect(stops[1].offset).toBeCloseTo(0.15, 9);
  expect(stops[3].offset).toBeCloseTo(0.58, 9);
});

test("les arrêts restent croissants et dans le cadre", () => {
  for (const meanAt of [-1, 0, 0.5, 1, 2]) {
    const stops = paceGradientStops(meanAt);

    for (const [i, stop] of stops.entries()) {
      expect(stop.offset).toBeGreaterThanOrEqual(0);
      expect(stop.offset).toBeLessThanOrEqual(1);
      if (i > 0) expect(stop.offset).toBeGreaterThan(stops[i - 1].offset);
    }
  }
});

test("le dégradé de la légende va du bleu au rouge", () => {
  expect(PACE_GRADIENT).toContain(`${BLEU} 0%`);
  expect(PACE_GRADIENT).toContain(`${VERT} 50%`);
  expect(PACE_GRADIENT).toContain(`${ROUGE} 100%`);
});
