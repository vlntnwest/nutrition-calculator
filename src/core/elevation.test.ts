import { expect, test } from "vitest";
import { elevationGain, fillMissingElevation } from "./elevation";

test("une trace sans point est refusée", () => {
  expect(() => fillMissingElevation([])).toThrow("File without points");
});

test("une trace sans la moindre altitude est refusée", () => {
  expect(() =>
    fillMissingElevation([
      { lat: 0, lon: 0, ele: null, d: 0 },
      { lat: 0, lon: 0, ele: null, d: 0 },
      { lat: 0, lon: 0, ele: null, d: 0 },
    ]),
  ).toThrow("File without elevation data");
});

test("une altitude absente s'interpole entre ses voisines", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: 100, d: 0 },
      { lat: 1, lon: 0, ele: 200, d: 111195.08 },
      { lat: 2, lon: 0, ele: null, d: 222390.16 },
      { lat: 3, lon: 0, ele: 400, d: 333585.24 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 200, d: 111195.08 },
    { lat: 2, lon: 0, ele: 300, d: 222390.16 },
    { lat: 3, lon: 0, ele: 400, d: 333585.24 },
  ]);
});

test("l'interpolation suit l'abscisse, pas le rang du point", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: 100, d: 0 },
      { lat: 1, lon: 0, ele: null, d: 100 },
      { lat: 2, lon: 0, ele: null, d: 400 },
      { lat: 3, lon: 0, ele: 500, d: 500 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 180, d: 100 },
    { lat: 2, lon: 0, ele: 420, d: 400 },
    { lat: 3, lon: 0, ele: 500, d: 500 },
  ]);
});

test("les altitudes absentes au départ prennent la première connue", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: null, d: 0 },
      { lat: 1, lon: 0, ele: null, d: 100 },
      { lat: 2, lon: 0, ele: 400, d: 400 },
      { lat: 3, lon: 0, ele: 500, d: 500 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 400, d: 0 },
    { lat: 1, lon: 0, ele: 400, d: 100 },
    { lat: 2, lon: 0, ele: 400, d: 400 },
    { lat: 3, lon: 0, ele: 500, d: 500 },
  ]);
});

test("les altitudes absentes à l'arrivée prennent la dernière connue", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: 100, d: 0 },
      { lat: 1, lon: 0, ele: 200, d: 100 },
      { lat: 2, lon: 0, ele: null, d: 400 },
      { lat: 3, lon: 0, ele: null, d: 500 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 200, d: 100 },
    { lat: 2, lon: 0, ele: 200, d: 400 },
    { lat: 3, lon: 0, ele: 200, d: 500 },
  ]);
});

test("deux points confondus sans altitude prennent la même", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: 100, d: 0 },
      { lat: 1, lon: 0, ele: null, d: 100 },
      { lat: 1, lon: 0, ele: null, d: 100 },
      { lat: 3, lon: 0, ele: 200, d: 200 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 150, d: 100 },
    { lat: 1, lon: 0, ele: 150, d: 100 },
    { lat: 3, lon: 0, ele: 200, d: 200 },
  ]);
});

test("un trou encadré au même endroit reprend l'altitude d'avant", () => {
  expect(
    fillMissingElevation([
      { lat: 0, lon: 0, ele: 100, d: 0 },
      { lat: 1, lon: 0, ele: 150, d: 100 },
      { lat: 1, lon: 0, ele: null, d: 100 },
      { lat: 3, lon: 0, ele: 250, d: 100 },
    ]),
  ).toEqual([
    { lat: 0, lon: 0, ele: 100, d: 0 },
    { lat: 1, lon: 0, ele: 150, d: 100 },
    { lat: 1, lon: 0, ele: 150, d: 100 },
    { lat: 3, lon: 0, ele: 250, d: 100 },
  ]);
});

// Elevation Gain

test("ignore le bruit sous le seuil et garde la montée nette", () => {
  expect(
    elevationGain(
      [
        { lat: 0, lon: 0, d: 0, ele: 100 },
        { lat: 1, lon: 0, d: 10, ele: 102 },
        { lat: 2, lon: 0, d: 20, ele: 101 },
        { lat: 3, lon: 0, d: 30, ele: 103 },
        { lat: 3, lon: 0, d: 40, ele: 102 },
        { lat: 3, lon: 0, d: 50, ele: 104 },
      ],
      3,
    ),
  ).toEqual(4);
});

test("une montée franche se compte en entier", () => {
  expect(
    elevationGain(
      [
        { lat: 0, lon: 0, d: 0, ele: 100 },
        { lat: 1, lon: 0, d: 10, ele: 110 },
        { lat: 2, lon: 0, d: 20, ele: 120 },
      ],
      3,
    ),
  ).toEqual(20);
});
