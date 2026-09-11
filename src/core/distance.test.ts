import { expect, test } from "vitest";
import { haversine, withCumulativeDistance } from "./distance";
import type { RawPoint } from "./type.ts";

test("un degré de latitude vaut cent onze kilomètres", () => {
  expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(
    111195.08,
    1,
  );
});

test("les distances se cumulent depuis le départ", () => {
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

test("une trace vide ressort vide", () => {
  const points: RawPoint[] = [];
  expect(withCumulativeDistance(points)).toEqual([]);
});

test("un point seul est au kilomètre zéro", () => {
  const points = [{ lat: 0, lon: 0, ele: 100 }];
  expect(withCumulativeDistance(points)).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
  ]);
});

test("deux points confondus ne font pas avancer l'abscisse", () => {
  const points = [
    { lat: 0, lon: 0, ele: 100 },
    { lat: 1, lon: 0, ele: 200 },
    { lat: 1, lon: 0, ele: 300 },
    { lat: 2, lon: 0, ele: 300 },
  ];
  const result = withCumulativeDistance(points);

  expect(result[2].d).toEqual(result[1].d);
  expect(result[3].d).toBeGreaterThan(result[2].d);
});
