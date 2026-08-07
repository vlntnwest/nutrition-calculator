import { expect, test } from "vitest";
import { elevationGain, fillMissingElevation } from "./elevation";

test("renvoie erreuer si le tableau est vide en entrée", () => {
  expect(() => fillMissingElevation([])).toThrow("File without points");
});

test("renvoie erreuer si le tableau n'a pas d'élévation", () => {
  expect(() =>
    fillMissingElevation([
      { lat: 0, lon: 0, ele: null, d: 0 },
      { lat: 0, lon: 0, ele: null, d: 0 },
      { lat: 0, lon: 0, ele: null, d: 0 },
    ]),
  ).toThrow("File without elevation data");
});

test("calcul l'elevation entre les points avec un null", () => {
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

test("l'elevation est interpolé sur d et non sur l'index", () => {
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

test("complete les null en début de tableau", () => {
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

test("complete les null en fin de tableau", () => {
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

test("deux points consécutifs sans elevation au meme endroit", () => {
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

test("point avant et apres le null au meme endroit recupere le before", () => {
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

test("elevation gain simple", () => {
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
