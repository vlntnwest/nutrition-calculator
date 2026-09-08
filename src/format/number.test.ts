import { expect, test } from "vitest";
import { duree, ecart, entier, km, quantite, toNumber } from "./number";

test.each([
  ["9,8", 9.8],
  ["9.8", 9.8],
  [" 70 ", 70],
  ["", undefined],
  [",", undefined],
  ["abc", undefined],
])("toNumber(%o) → %o", (saisie, attendu) => {
  expect(toNumber(saisie)).toBe(attendu);
});

test.each([
  [28350, "28,4"],
  [1000, "1,0"],
  [0, "0,0"],
])("km(%o) → %o", (metres, attendu) => {
  expect(km(metres)).toBe(attendu);
});

test("entier groupe les milliers à la française", () => {
  // L'espace de groupement du français est insécable, pas une espace simple.
  expect(entier(1314).replace(/ | /g, " ")).toBe("1 314");
});

test.each([
  [0.5, "0,5"],
  [2, "2"],
  [1.5, "1,5"],
])("quantite(%o) → %o", (valeur, attendu) => {
  expect(quantite(valeur)).toBe(attendu);
});

test.each([
  [540, "9 min"],
  [4556, "1 h 16"],
  [13500, "3 h 45"],
  [0, "0 min"],
])("duree(%o) → %o", (secondes, attendu) => {
  expect(duree(secondes)).toBe(attendu);
});

test.each([
  [0.4, ""],
  [-0.9, ""],
  [6.2, "+6 g"],
  [-29.4, "−29 g"],
])("ecart(%o) → %o", (grammes, attendu) => {
  expect(ecart(grammes)).toBe(attendu);
});

test("ecart prend une unité et un seuil au besoin du sodium et de l'eau", () => {
  expect(ecart(4, "mg", 5)).toBe("");
  expect(ecart(120, "mg", 5)).toBe("+120 mg");
  expect(ecart(-80, "mL", 5)).toBe("−80 mL");
});
