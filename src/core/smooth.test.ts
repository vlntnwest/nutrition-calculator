import { expect, test } from "vitest";
import { meanFilter, medianFilter, smooth } from "./smooth";

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
