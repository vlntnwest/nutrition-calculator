import { expect, test } from "vitest";
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
