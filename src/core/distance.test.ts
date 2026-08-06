import { expect, test } from "vitest";
import { haversine, withCumulativeDistance } from "./distance";
import type { RawPoint } from "./parseGpx";

test("verifie une distance calculé par haversine", () => {
  expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(
    111195.08,
    1,
  );
});

test("cumule les distances depuis le départ", () => {
  const points = [
    { lat: 0, lon: 0, ele: 100 },
    { lat: 1, lon: 0, ele: 200 },
    { lat: 2, lon: 0, ele: 300 },
  ];
  expect(withCumulativeDistance(points)).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 200, d: expect.closeTo(111195.08, 1) },
    { lat: 2, lon: 0, ele: 300, d: expect.closeTo(222390.16, 1) },
  ]);
});

test("retourne un tableau vide quand le tableau d'entrée est vide", () => {
  const points: RawPoint[] = [];
  expect(withCumulativeDistance(points)).toEqual([]);
});

test("retourne un tableau avec un seul point quand le tableau d'entrée contient un seul point", () => {
  const points = [{ lat: 0, lon: 0, ele: 100 }];
  expect(withCumulativeDistance(points)).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
  ]);
});

test("la distance cumulative est egale ou croissante", () => {
  const points = [
    { lat: 0, lon: 0, ele: 100 },
    { lat: 1, lon: 0, ele: 200 },
    { lat: 1, lon: 0, ele: 300 },
    { lat: 2, lon: 0, ele: 300 },
  ];
  const result = withCumulativeDistance(points);
  expect(result[0].d).toBe(0);
  expect(result[1].d).toBeGreaterThan(result[0].d);
  expect(result[2].d).toEqual(result[1].d);
  expect(result[3].d).toBeGreaterThan(result[2].d);
});
