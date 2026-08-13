import { expect, test } from "vitest";
import { elevationGain } from "./elevation";
import { meanFilter, medianFilter, smooth } from "./smooth";
import type { ResolvedPoint } from "./type";

/** Une trace à pas de 10 m, à partir d'une liste d'altitudes. */
function trace(altitudes: number[]): ResolvedPoint[] {
  return altitudes.map((ele, i) => ({ lat: 0, lon: 0, d: i * 10, ele }));
}

/**
 * Le test qui définit ce qu'on attend du lissage : distinguer le décrochage
 * d'altimètre du relief. Un pic isolé de 200 m n'existe pas sur le terrain —
 * une côte de 50 m, si.
 */
test("un pic de 200 m disparaît, une côte de 50 m survit", () => {
  // 2 km de plat, avec un décrochage d'un seul point à mi-parcours.
  const flat = new Array(201).fill(0);
  flat[100] = 200;

  const smoothed = smooth(trace(flat), 30, 0);

  expect(Math.max(...smoothed.map((p) => p.ele))).toBe(0);
  expect(elevationGain(smoothed, 0)).toBe(0);

  // La même trace, mais avec une vraie côte : 50 m sur 500, soit 10 %.
  const climb = [
    ...new Array(75).fill(0),
    ...Array.from({ length: 51 }, (_, i) => i),
    ...new Array(75).fill(50),
  ];

  expect(elevationGain(smooth(trace(climb), 30, 0), 0)).toBeCloseTo(50, 6);
});

test("rend les mediannes en fonction de la fenêtre en mètre", () => {
  expect(
    medianFilter(
      [
        { d: 0, lat: 0, lon: 0, ele: 100 },
        { d: 10, lat: 1, lon: 1, ele: 100 },
        { d: 20, lat: 2, lon: 2, ele: 130 },
        { d: 30, lat: 2, lon: 2, ele: 100 },
        { d: 40, lat: 2, lon: 2, ele: 100 },
      ],
      30,
    ),
  ).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 1, lon: 1, ele: 100 },
    { d: 20, lat: 2, lon: 2, ele: 100 },
    { d: 30, lat: 2, lon: 2, ele: 100 },
    { d: 40, lat: 2, lon: 2, ele: 100 },
  ]);
});

test("rend les moyennes en fonction de la fenêtre en mètre", () => {
  expect(
    meanFilter(
      [
        { d: 0, lat: 0, lon: 0, ele: 100 },
        { d: 10, lat: 1, lon: 1, ele: 100 },
        { d: 20, lat: 2, lon: 2, ele: 130 },
        { d: 30, lat: 2, lon: 2, ele: 100 },
        { d: 40, lat: 2, lon: 2, ele: 100 },
      ],
      30,
    ),
  ).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 1, lon: 1, ele: 110 },
    { d: 20, lat: 2, lon: 2, ele: 110 },
    { d: 30, lat: 2, lon: 2, ele: 110 },
    { d: 40, lat: 2, lon: 2, ele: 100 },
  ]);
});

test("applique un lissage médian puis une moyenne", () => {
  expect(
    smooth([
      { d: 0, lat: 0, lon: 0, ele: 100 },
      { d: 10, lat: 1, lon: 1, ele: 100 },
      { d: 20, lat: 2, lon: 2, ele: 130 },
      { d: 30, lat: 2, lon: 2, ele: 100 },
      { d: 40, lat: 2, lon: 2, ele: 100 },
    ]),
  ).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 1, lon: 1, ele: 100 },
    { d: 20, lat: 2, lon: 2, ele: 100 },
    { d: 30, lat: 2, lon: 2, ele: 100 },
    { d: 40, lat: 2, lon: 2, ele: 100 },
  ]);
});

/**
 * ADR 006 : une fenêtre nulle ou négative saute le filtre, elle ne produit pas
 * une fenêtre d'un point. Une fenêtre négative ou `NaN` rendait `half` invalide,
 * la fenêtre glissante se vidait, et la médiane lisait un point inexistant.
 */
test("une fenêtre invalide saute le filtre au lieu de planter", () => {
  const points: ResolvedPoint[] = [
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 0, lon: 0, ele: 300 }, // le pic que la médiane écraserait
    { d: 20, lat: 0, lon: 0, ele: 100 },
    { d: 30, lat: 0, lon: 0, ele: 100 },
  ];

  for (const windowM of [0, -1, Number.NaN]) {
    expect(medianFilter(points, windowM)).toEqual(points);
    expect(meanFilter(points, windowM)).toEqual(points);
  }

  // `Infinity` reste valide : la fenêtre couvre toute la trace.
  expect(medianFilter(points, Number.POSITIVE_INFINITY)[1].ele).toBe(100);

  // Et le pic disparaît bien dès que la fenêtre est réelle : le garde ne
  // désactive pas le filtre par mégarde.
  expect(medianFilter(points, 30)[1].ele).toBe(100);
});
