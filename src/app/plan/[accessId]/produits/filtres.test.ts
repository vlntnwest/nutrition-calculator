import { expect, test } from "vitest";
import type { CatalogueEntry } from "@/app/plans/catalogue";
import { aucunFiltre, bascule, FILTRES_VIDES, filtrer } from "./filtres";

function produit(patch: Partial<CatalogueEntry>): CatalogueEntry {
  return {
    codeSeed: "x",
    name: "Produit",
    brandName: "Näak",
    formatLabel: "gel",
    carbsG: 27,
    sodiumMg: 190,
    energyKcal: 200,
    weightG: 57,
    fluidMl: 0,
    divisibleBy: 1,
    multiTransportable: true,
    purchaseUrl: null,
    ...patch,
  };
}

const CATALOGUE = [
  produit({ codeSeed: "naak-gel", name: "Ultra Energy Gel" }),
  produit({
    codeSeed: "naak-puree",
    name: "Purée pomme",
    formatLabel: "puree",
    carbsG: 26,
  }),
  produit({
    codeSeed: "baouw-barre",
    name: "Barre Extra",
    brandName: "Baouw",
    formatLabel: "bar",
    carbsG: 24.7,
  }),
  produit({
    codeSeed: "naak-drink",
    name: "Drink Mix",
    formatLabel: "drink",
    carbsG: 55,
  }),
];

const codes = (entrees: CatalogueEntry[]) => entrees.map((e) => e.codeSeed);

test("sans filtre, le catalogue passe entier", () => {
  expect(filtrer(CATALOGUE, FILTRES_VIDES)).toHaveLength(4);
  expect(aucunFiltre(FILTRES_VIDES)).toBe(true);
});

test("la recherche ignore les accents et la casse", () => {
  expect(
    codes(filtrer(CATALOGUE, { ...FILTRES_VIDES, recherche: "PUREE" })),
  ).toEqual(["naak-puree"]);
});

test("la recherche porte aussi sur la marque", () => {
  expect(
    codes(filtrer(CATALOGUE, { ...FILTRES_VIDES, recherche: "baouw" })),
  ).toEqual(["baouw-barre"]);
});

test("deux valeurs d'une même facette élargissent", () => {
  const gardes = filtrer(CATALOGUE, {
    ...FILTRES_VIDES,
    formats: ["gel", "bar"],
  });

  expect(codes(gardes)).toEqual(["naak-gel", "baouw-barre"]);
});

test("deux facettes différentes restreignent", () => {
  const gardes = filtrer(CATALOGUE, {
    ...FILTRES_VIDES,
    formats: ["gel", "bar"],
    marques: ["Baouw"],
  });

  expect(codes(gardes)).toEqual(["baouw-barre"]);
});

test("le palier de glucides coupe sur la dose", () => {
  expect(
    codes(filtrer(CATALOGUE, { ...FILTRES_VIDES, palier: "plus-40" })),
  ).toEqual(["naak-drink"]);
  expect(
    codes(filtrer(CATALOGUE, { ...FILTRES_VIDES, palier: "moins-25" })),
  ).toEqual(["baouw-barre"]);
});

test("bascule coche puis décoche", () => {
  expect(bascule([], "gel")).toEqual(["gel"]);
  expect(bascule(["gel", "bar"], "gel")).toEqual(["bar"]);
});
