import { expect, test } from "vitest";
import { resample } from "./resample";

test("resample deux points en quatre", () => {
  expect(
    resample(
      [
        { d: 0, lat: 0, lon: 0, ele: 100 },
        { d: 25, lat: 1, lon: 0, ele: 200 },
      ],
      10,
    ),
  ).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 0.4, lon: 0, ele: 140 },
    { d: 20, lat: 0.8, lon: 0, ele: 180 },
    { d: 25, lat: 1, lon: 0, ele: 200 },
  ]);
});

test("resample plusieurs points proche", () => {
  expect(
    resample([
      { d: 0, lat: 0, lon: 0, ele: 100 },
      { d: 5, lat: 0.5, lon: 0, ele: 150 },
      { d: 10, lat: 1, lon: 0, ele: 200 },
      { d: 50, lat: 5, lon: 0, ele: 600 },
    ]),
  ).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
    { d: 10, lat: 1, lon: 0, ele: 200 },
    { d: 20, lat: 2, lon: 0, ele: 300 },
    { d: 30, lat: 3, lon: 0, ele: 400 },
    { d: 40, lat: 4, lon: 0, ele: 500 },
    { d: 50, lat: 5, lon: 0, ele: 600 },
  ]);
});

test("un seul point d'entrée ressort le même point", () => {
  expect(resample([{ d: 0, lat: 0, lon: 0, ele: 100 }], 10)).toEqual([
    { d: 0, lat: 0, lon: 0, ele: 100 },
  ]);
});

test.each([
  { step: -5, raison: "négatif" },
  { step: 0, raison: "zéro" },
  { step: NaN, raison: "NaN" },
])("bloque stepM avec entrées erronées — $raison", ({ step }) => {
  expect(() =>
    resample(
      [
        { d: 0, lat: 0, lon: 0, ele: 100 },
        { d: 25, lat: 1, lon: 0, ele: 200 },
      ],
      step,
    ),
  ).toThrow("Step must be a finite positive number");
});
