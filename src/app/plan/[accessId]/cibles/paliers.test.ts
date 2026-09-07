import { expect, test } from "vitest";
import { echelle, paliersBoisson, paliersGlucides } from "./paliers";

test("une échelle va du plus bas au plus haut, au pas demandé", () => {
  expect(echelle(0, 20, 5, {}).map((p) => p.valeur)).toEqual([
    0, 5, 10, 15, 20,
  ]);
});

test("une valeur déjà enregistrée hors des crans garde sa place", () => {
  expect(echelle(0, 20, 5, {}, 12).map((p) => p.valeur)).toEqual([
    0, 5, 10, 12, 15, 20,
  ]);
});

test("une valeur déjà enregistrée sur un cran ne le double pas", () => {
  expect(echelle(0, 20, 5, {}, 10).map((p) => p.valeur)).toEqual([
    0, 5, 10, 15, 20,
  ]);
});

test("les seuils publiés portent leur mention, les autres crans rien", () => {
  const paliers = paliersGlucides(75);
  const mention = (valeur: number) =>
    paliers.find((p) => p.valeur === valeur)?.mention;

  expect(mention(60)).toContain("un seul type de sucre");
  expect(mention(90)).toContain("fourchette publiée");
  expect(mention(75)).toBeUndefined();
});

test("la boisson se règle au pas de cinquante millilitres", () => {
  const valeurs = paliersBoisson(500).map((p) => p.valeur);

  expect(valeurs[0]).toBe(100);
  expect(valeurs.at(-1)).toBe(1200);
  expect(valeurs).toContain(750);
  expect(valeurs).not.toContain(725);
});
