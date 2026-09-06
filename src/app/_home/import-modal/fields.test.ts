import { expect, test } from "vitest";
import {
  baseChronoHMS,
  digitsOnly,
  paceLabel,
  raceNameFromFileName,
  toSecondsHMS,
} from "./fields";

test.each([
  ["12", "12"],
  ["1", "1"],
  ["123", "12"],
  ["ab", ""],
  ["1a2", "12"],
  ["", ""],
])("digitsOnly(%o) → %o", (saisie, attendu) => {
  expect(digitsOnly(saisie)).toBe(attendu);
});

test.each([
  ["", "", "", undefined],
  ["  ", " ", "", undefined],
  ["1", "", "30", 3630],
  ["03", "45", "00", 13500],
  ["0", "0", "9", 9],
  ["3", "45", "", 13500],
])("toSecondsHMS(%o, %o, %o) → %o", (h, m, s, attendu) => {
  expect(toSecondsHMS(h, m, s)).toBe(attendu);
});

test.each([
  ["saintelyon-2026.gpx", "saintelyon 2026"],
  ["Traversee_des_Cimes.gpx", "Traversee des Cimes"],
  ["trail.GPX", "trail"],
  ["sans-extension", "sans extension"],
])("raceNameFromFileName(%o) → %o", (fileName, attendu) => {
  expect(raceNameFromFileName(fileName)).toBe(attendu);
});

test.each([
  [undefined, 28400, undefined],
  [13500, 0, undefined],
  // 3 h 45 sur 28,4 km : 13500 / 28.4 = 475,35 s/km → 07:55.
  [13500, 28400, "07:55"],
  // 4 h tout rond sur 20 km : 720 s/km, pile 12:00.
  [14400, 20000, "12:00"],
  // Les secondes arrondies à 60 tout rond portent la minute.
  [1200, 1000 * (1200 / 59.6), "01:00"],
])("paceLabel(%o, %o) → %o", (targetTimeS, distanceM, attendu) => {
  expect(paceLabel(targetTimeS, distanceM)).toBe(attendu);
});

test.each([
  [0, { h: "", m: "", s: "" }],
  // 10 km à 6 min/km : 1 h tout rond.
  [10000, { h: "01", m: "00", s: "00" }],
  // 42,195 km : 15 190,2 s arrondies à 15 190 → 4 h 13 min 10 s.
  [42195, { h: "04", m: "13", s: "10" }],
])("baseChronoHMS(%o) → %o", (distanceM, attendu) => {
  expect(baseChronoHMS(distanceM)).toEqual(attendu);
});

test("le chrono de base se relit bien à 6 min/km", () => {
  for (const distanceM of [5000, 21097, 42195, 168000]) {
    const { h, m, s } = baseChronoHMS(distanceM);
    expect(paceLabel(toSecondsHMS(h, m, s), distanceM)).toBe("06:00");
  }
});
