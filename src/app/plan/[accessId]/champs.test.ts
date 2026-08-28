import { expect, test } from "vitest";
import { nombre, toClock, toSeconds } from "./champs";

test.each([
  ["9", 9],
  ["9.8", 9.8],
  // Un clavier français met une virgule. C'est la saisie normale, pas un cas
  // limite : `Number("9,8")` rend NaN.
  ["9,8", 9.8],
  // En cours de frappe : le séparateur seul ne vaut pas encore un chiffre,
  // mais il ne doit pas non plus détruire ce qui précède.
  ["9.", 9],
  ["9,", 9],
  ["", undefined],
  ["   ", undefined],
  ["abc", undefined],
  ["9 8", undefined],
])("nombre(%o) → %o", (saisie, attendu) => {
  expect(nombre(saisie)).toBe(attendu);
});

test.each([
  ["03:45", 13500],
  ["3:45", 13500],
  ["00:30", 1800],
  ["12:00", 43200],
  ["", undefined],
  ["03", undefined],
  ["ab:cd", undefined],
])("toSeconds(%o) → %o", (saisie, attendu) => {
  expect(toSeconds(saisie)).toBe(attendu);
});

test.each([
  [13500, "03:45"],
  [1800, "00:30"],
  [undefined, ""],
])("toClock(%o) → %o", (secondes, attendu) => {
  expect(toClock(secondes)).toBe(attendu);
});

test("l'aller-retour d'un chrono ne perd rien", () => {
  expect(toSeconds(toClock(13500))).toBe(13500);
});
