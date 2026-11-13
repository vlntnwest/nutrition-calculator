import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { listProducts } from "./catalogue";
import { createPlan } from "./createPlan";
import { getPlan } from "./getPlan";
import { newPlan } from "./newPlan.fixture";
import {
  addOwnProduct,
  MAX_OWN_PRODUCTS,
  type OwnProductInput,
  removeOwnProduct,
} from "./ownProducts";
import { regeneratePlan } from "./regeneratePlan";
import { updatePlan } from "./updatePlan";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    const accessId = written.pop() as string;
    // Les rations retiennent les instantanés, qui retiennent les produits.
    await db.delete(legs).where(eq(legs.planId, accessId));
    await db
      .delete(productSnapshots)
      .where(eq(productSnapshots.planId, accessId));
    await db.delete(plans).where(eq(plans.accessId, accessId));
  }
});

async function ouvrir(): Promise<string> {
  const accessId = await createPlan(newPlan);
  written.push(accessId);

  return accessId;
}

const gateau = {
  name: "  Gâteau de riz  ",
  formatLabel: "bar",
  weightG: 60,
  carbsG: 24.04,
  sodiumMg: 120,
  divisibleBy: 2,
  multiTransportable: false,
} satisfies OwnProductInput;

test("un produit saisi paraît en tête du catalogue de son plan", async () => {
  const accessId = await ouvrir();

  const codeSeed = await addOwnProduct(accessId, gateau);

  const [premier] = await listProducts(accessId);
  expect(premier).toEqual({
    codeSeed,
    name: "Gâteau de riz",
    brandName: "Perso",
    formatLabel: "bar",
    carbsG: 24,
    sodiumMg: 120,
    // Quatre kilocalories par gramme, faute d'énergie saisie.
    energyKcal: 96,
    weightG: 60,
    fluidMl: 0,
    divisibleBy: 2,
    multiTransportable: false,
    purchaseUrl: null,
    own: true,
  });
});

test("la marque tapée s'affiche, sans entrer dans les marques du catalogue", async () => {
  const accessId = await ouvrir();

  const codeSeed = await addOwnProduct(accessId, {
    ...gateau,
    brandName: "Maison Dupont",
  });

  const entree = (await listProducts(accessId)).find(
    (p) => p.codeSeed === codeSeed,
  );
  expect(entree?.brandName).toBe("Maison Dupont");
  expect((await listProducts()).map((p) => p.brandName)).not.toContain(
    "Maison Dupont",
  );
});

test("un produit saisi ne sort ni au catalogue ni chez un autre plan", async () => {
  const accessId = await ouvrir();
  const voisin = await ouvrir();

  const codeSeed = await addOwnProduct(accessId, gateau);

  expect((await listProducts()).map((p) => p.codeSeed)).not.toContain(codeSeed);
  expect((await listProducts(voisin)).map((p) => p.codeSeed)).not.toContain(
    codeSeed,
  );
});

test("un autre plan ne peut pas mettre ce produit dans son sac", async () => {
  const accessId = await ouvrir();
  const voisin = await ouvrir();
  const codeSeed = await addOwnProduct(accessId, gateau);

  await expect(
    updatePlan(voisin, { productCodes: [codeSeed] }),
  ).rejects.toThrow(`Unknown product codes: ${codeSeed}`);
});

test("un produit saisi se met au sac et entre dans le calcul", async () => {
  const accessId = await ouvrir();
  const codeSeed = await addOwnProduct(accessId, {
    ...gateau,
    brandName: "Maison Dupont",
  });

  await updatePlan(accessId, {
    productCodes: [...newPlan.productCodes, codeSeed],
  });
  await regeneratePlan(accessId);

  expect((await getPlan(accessId))?.productCodes).toContain(codeSeed);
  const figes = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.planId, accessId));
  expect(figes.find((s) => s.name === "Gâteau de riz")).toMatchObject({
    brandName: "Maison Dupont",
    formatLabel: "bar",
    carbsG: 24,
    divisibleBy: 2,
  });
});

test("supprimer un produit saisi le sort du sac et jette le calcul", async () => {
  const accessId = await ouvrir();
  const codeSeed = await addOwnProduct(accessId, gateau);
  await updatePlan(accessId, {
    productCodes: [...newPlan.productCodes, codeSeed],
  });
  await regeneratePlan(accessId);

  await removeOwnProduct(accessId, codeSeed);

  expect((await getPlan(accessId))?.productCodes).toEqual(
    [...newPlan.productCodes].sort(),
  );
  expect(
    await db.select().from(products).where(eq(products.codeSeed, codeSeed)),
  ).toEqual([]);
  expect(await db.select().from(legs).where(eq(legs.planId, accessId))).toEqual(
    [],
  );
});

test("supprimer ne touche ni au catalogue ni au produit d'un autre plan", async () => {
  const accessId = await ouvrir();
  const voisin = await ouvrir();
  const codeSeed = await addOwnProduct(voisin, gateau);

  await removeOwnProduct(accessId, codeSeed);
  await removeOwnProduct(accessId, "naak-gel-ultra");

  const restants = (await listProducts(voisin)).map((p) => p.codeSeed);
  expect(restants).toContain(codeSeed);
  expect(restants).toContain("naak-gel-ultra");
  expect((await getPlan(accessId))?.productCodes).toContain("naak-gel-ultra");
});

test("les produits saisis partent avec le plan", async () => {
  const accessId = await createPlan(newPlan);
  const codeSeed = await addOwnProduct(accessId, gateau);
  await updatePlan(accessId, { productCodes: [codeSeed] });

  await db
    .delete(productSnapshots)
    .where(eq(productSnapshots.planId, accessId));
  await db.delete(plans).where(eq(plans.accessId, accessId));

  expect(
    await db.select().from(products).where(eq(products.codeSeed, codeSeed)),
  ).toEqual([]);
});

test("une boisson se prépare dans un volume, le reste n'en garde pas", async () => {
  const accessId = await ouvrir();

  await expect(
    addOwnProduct(accessId, { ...gateau, formatLabel: "drink" }),
  ).rejects.toThrow("Indiquez le volume d'eau");

  const boisson = await addOwnProduct(accessId, {
    ...gateau,
    formatLabel: "drink",
    fluidMl: 500,
  });
  const barre = await addOwnProduct(accessId, { ...gateau, fluidMl: 500 });

  const entrees = await listProducts(accessId);
  expect(entrees.find((p) => p.codeSeed === boisson)?.fluidMl).toBe(500);
  expect(entrees.find((p) => p.codeSeed === barre)?.fluidMl).toBe(0);
});

test.each([
  [{ name: "   " }, "Donnez un nom au produit."],
  [{ name: "x".repeat(81) }, "Le nom tient en 80 caractères au plus."],
  [{ formatLabel: "poudre" }, "Choisissez un format dans la liste."],
  [{ carbsG: 0 }, "Indiquez les glucides d'une dose, en grammes."],
  [{ carbsG: Number.NaN }, "Indiquez les glucides d'une dose, en grammes."],
  [{ carbsG: 120 }, "Une dose porte moins de 100 g de glucides"],
  [{ weightG: 0 }, "Indiquez le poids d'une dose, en grammes."],
  [{ sodiumMg: -5 }, "Indiquez le sodium d'une dose"],
  [{ energyKcal: 50 }, "L'énergie ne colle pas aux glucides"],
  [{ caffeineMg: -1 }, "Indiquez la caféine en milligrammes"],
] satisfies [
  Partial<OwnProductInput>,
  string,
][])("une saisie fausse est refusée avec ce qu'il faut corriger : %o", async (patch, message) => {
  const accessId = await ouvrir();

  await expect(
    addOwnProduct(accessId, { ...gateau, ...patch }),
  ).rejects.toThrow(message);
  expect((await listProducts(accessId)).some((p) => p.own)).toBe(false);
});

test("un plan inconnu ne reçoit pas de produit", async () => {
  await expect(
    addOwnProduct("00000000-0000-4000-8000-000000000000", gateau),
  ).rejects.toThrow("Unknown plan");
});

test("un plan ne porte qu'un nombre borné de produits saisis", async () => {
  const accessId = await ouvrir();
  for (let i = 0; i < MAX_OWN_PRODUCTS; i++) {
    await addOwnProduct(accessId, { ...gateau, name: `Gâteau ${i}` });
  }

  await expect(addOwnProduct(accessId, gateau)).rejects.toThrow(
    `Un plan porte ${MAX_OWN_PRODUCTS} produits saisis au plus.`,
  );
});
