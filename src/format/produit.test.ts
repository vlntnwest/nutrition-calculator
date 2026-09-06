import { expect, test } from "vitest";
import { coupeFr, formatFr, formatPluriel, nomProduit } from "./produit";

test.each([
  ["gel", "gel"],
  ["bar", "barre"],
  ["drink", "boisson"],
  ["puree", "purée"],
  ["waffle", "gaufre"],
])("formatFr(%o) → %o", (label, attendu) => {
  expect(formatFr(label)).toBe(attendu);
});

test("un format inconnu ressort tel quel plutôt que de disparaître", () => {
  expect(formatFr("tablette")).toBe("tablette");
});

test.each([
  ["gel", "gels"],
  ["puree", "purées"],
  // « boissons » : le pluriel ne double pas un mot déjà terminé par un s.
  ["bar", "barres"],
])("formatPluriel(%o) → %o", (label, attendu) => {
  expect(formatPluriel(label)).toBe(attendu);
});

test("le pas de retouche se dit en toutes lettres", () => {
  expect(coupeFr(2)).toBe("se coupe en deux");
  expect(coupeFr(1)).toContain("ne se coupe pas");
});

test.each([
  [
    "Ultra Energy Drink Mix — Salted Soup",
    "Ultra Energy Drink Mix, Salted Soup",
  ],
  ["Gaufre ULTRA - Citron", "Gaufre ULTRA, Citron"],
  ["Purée – Pomme", "Purée, Pomme"],
])("nomProduit(%o) → %o", (nom, attendu) => {
  expect(nomProduit(nom)).toBe(attendu);
});

test("un trait d'union de mot composé n'est pas un séparateur", () => {
  expect(nomProduit("Ultra-Trail Energy")).toBe("Ultra-Trail Energy");
  expect(nomProduit("Purée pomme et sirop d'érable")).toBe(
    "Purée pomme et sirop d'érable",
  );
});
