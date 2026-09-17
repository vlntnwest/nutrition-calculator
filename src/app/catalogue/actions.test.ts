import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema/products";
import { addProduct, type NewProduct } from "./actions";

/** Marque et format existent dans le seed ; le reste tient les contraintes. */
const valide = {
  codeSeed: "test-gel-ajoute",
  brandName: "Näak",
  formatLabel: "gel",
  name: "Gel de test",
  weightG: 40,
  energyKcal: 100,
  carbsG: 25,
  sodiumMg: 50,
  caffeineMg: 0,
  fluidMl: 0,
  proteinG: undefined,
  fiberG: undefined,
  sugarG: 20,
  fatG: undefined,
  purchaseUrl: undefined,
  divisibleBy: 1,
  multiTransportable: false,
} satisfies NewProduct;

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete(products).where(eq(products.codeSeed, valide.codeSeed));
});

test("un produit ajouté se retrouve en base", async () => {
  expect(await addProduct(valide)).toEqual({ ok: true, value: null });

  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.codeSeed, valide.codeSeed));

  expect(row.name).toBe("Gel de test");
  expect(row.carbsG).toBe(25);
});

test("une marque inconnue est refusée avant l'écriture", async () => {
  const resultat = await addProduct({ ...valide, brandName: "Marque Fantôme" });

  expect(resultat).toEqual({
    ok: false,
    error: "Marque ou format introuvable.",
  });
  expect(
    await db
      .select()
      .from(products)
      .where(eq(products.codeSeed, valide.codeSeed)),
  ).toEqual([]);
});

test("un format inconnu est refusé avant l'écriture", async () => {
  expect(await addProduct({ ...valide, formatLabel: "poudre" })).toEqual({
    ok: false,
    error: "Marque ou format introuvable.",
  });
});

test("un identifiant déjà pris se dit en français", async () => {
  await addProduct(valide);

  expect(await addProduct({ ...valide, name: "Un autre nom" })).toEqual({
    ok: false,
    error: "Cet identifiant existe déjà.",
  });
});

test("un identifiant en majuscules est refusé par le format", async () => {
  expect(
    await addProduct({ ...valide, codeSeed: "Test-Gel-Majuscule" }),
  ).toEqual({
    ok: false,
    error: "L'identifiant se limite aux minuscules, chiffres et tirets.",
  });
});

test("du sucre au-dessus des glucides est refusé", async () => {
  expect(await addProduct({ ...valide, sugarG: 30 })).toEqual({
    ok: false,
    error: "Le sucre ne peut pas dépasser les glucides.",
  });
});

test("une contrainte non traduite rend un message générique, et se journalise", async () => {
  const journal = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await addProduct({ ...valide, name: "" })).toEqual({
    ok: false,
    error: "Une erreur inattendue est survenue.",
  });
  expect(journal).toHaveBeenCalled();
});
