import { expect, test } from "vitest";
import {
  baseChronoHMS,
  clockLabel,
  digitsOnly,
  fromHM,
  type HMS,
  paceLabel,
  raceNameFromFileName,
  toHM,
  toHMS,
  toSecondsHMS,
} from "./clock";

test.each([
  ["12", "12"],
  ["1a2", "12"],
  ["123", "12"],
  ["", ""],
  ["ab", ""],
])("digitsOnly(%o) → %o", (saisie, attendu) => {
  expect(digitsOnly(saisie)).toBe(attendu);
});

test.each<[HMS, number | undefined]>([
  [{ h: "", m: "", s: "" }, undefined],
  [{ h: "03", m: "45", s: "00" }, 13500],
  [{ h: "1", m: "", s: "30" }, 3630],
  [{ h: "", m: "90", s: "" }, 5400],
])("toSecondsHMS(%o) → %o", (saisie, attendu) => {
  expect(toSecondsHMS(saisie)).toBe(attendu);
});

test.each<[number | undefined, HMS]>([
  [undefined, { h: "", m: "", s: "" }],
  [13500, { h: "03", m: "45", s: "00" }],
  [3661, { h: "01", m: "01", s: "01" }],
])("toHMS(%o) → %o", (secondes, attendu) => {
  expect(toHMS(secondes)).toEqual(attendu);
});

test("toHMS et toSecondsHMS se relisent l'un l'autre", () => {
  for (const secondes of [0, 59, 3600, 13500, 86399]) {
    expect(toSecondsHMS(toHMS(secondes))).toBe(secondes);
  }
});

test.each([
  ["saintelyon-2026.gpx", "saintelyon 2026"],
  ["Saverne_Trail.gpx", "Saverne Trail"],
  ["trace.gpx", "trace"],
])("raceNameFromFileName(%o) → %o", (fichier, attendu) => {
  expect(raceNameFromFileName(fichier)).toBe(attendu);
});

test.each([
  [undefined, 10000, undefined],
  [13500, 0, undefined],
  [3600, 10000, "06:00"],
  // 28,4 km en 3 h 45 : 475,4 s/km, arrondies à la seconde.
  [13500, 28400, "07:55"],
])("paceLabel(%o, %o) → %o", (targetTimeS, distanceM, attendu) => {
  expect(paceLabel(targetTimeS, distanceM)).toBe(attendu);
});

test("l'arrondi des secondes ne rend jamais une allure à 60 s", () => {
  // 1 km en 59,6 s par kilomètre : le report doit donner 01:00, pas 00:60.
  expect(paceLabel(60, 1000)).toBe("01:00");
});

test.each<[number, HMS]>([
  [0, { h: "", m: "", s: "" }],
  [10000, { h: "01", m: "00", s: "00" }],
  // 42,195 km : 15 190,2 s arrondies à 15 190 → 4 h 13 min 10 s.
  [42195, { h: "04", m: "13", s: "10" }],
])("baseChronoHMS(%o) → %o", (distanceM, attendu) => {
  expect(baseChronoHMS(distanceM)).toEqual(attendu);
});

test("le chrono de base se relit bien à 6 min/km", () => {
  for (const distanceM of [5000, 21097, 42195, 168000]) {
    expect(paceLabel(toSecondsHMS(baseChronoHMS(distanceM)), distanceM)).toBe(
      "06:00",
    );
  }
});

test("une heure de départ se relit en deux cases et se réécrit en `HH:MM`", () => {
  expect(toHM("05:30")).toEqual({ h: "05", m: "30" });
  expect(toHM(undefined)).toEqual({ h: "", m: "" });
  expect(fromHM({ h: "5", m: "30" })).toBe("05:30");
  expect(fromHM({ h: "", m: "" })).toBeUndefined();
});

test("une heure de départ hors du cadran est refusée, pas ramenée", () => {
  expect(fromHM({ h: "24", m: "00" })).toBeUndefined();
  expect(fromHM({ h: "12", m: "60" })).toBeUndefined();
});

test("l'heure de passage suit le temps écoulé depuis le départ", () => {
  expect(clockLabel("05:30", 8 * 3600 + 18 * 60)).toBe("13 h 48");
  expect(clockLabel("05:30", 0)).toBe("05 h 30");
});

test("un passage après minuit porte son jour de report", () => {
  expect(clockLabel("22:00", 9 * 3600)).toBe("07 h 00 +1 j");
  expect(clockLabel("22:00", 30 * 3600)).toBe("04 h 00 +2 j");
});
