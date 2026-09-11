import { eq, sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema/products";
import { listProducts } from "./catalogue";

const retires: string[] = [];

afterEach(async () => {
  while (retires.length > 0) {
    await db
      .update(products)
      .set({ discontinuedAt: null })
      .where(eq(products.codeSeed, retires.pop() as string));
  }
});

async function retirerDuMarche(codeSeed: string) {
  retires.push(codeSeed);
  await db
    .update(products)
    .set({ discontinuedAt: sql`now()` })
    .where(eq(products.codeSeed, codeSeed));
}

test("un produit du catalogue porte tout ce qu'un écran affiche", async () => {
  const entree = (await listProducts()).find(
    (p) => p.codeSeed === "naak-gel-ultra",
  );

  expect(entree).toMatchObject({
    name: "Ultra Energy Gel",
    brandName: "Näak",
    formatLabel: "gel",
    carbsG: 27,
    sodiumMg: 190,
    energyKcal: 200,
    weightG: 57,
    divisibleBy: 1,
    multiTransportable: true,
  });
});

/**
 * Un plan déjà enregistré garde son instantané : c'est la composition d'un
 * plan neuf qu'on ferme, pas la relecture des anciens.
 */
test("un produit retiré du marché sort du catalogue", async () => {
  expect((await listProducts()).map((p) => p.codeSeed)).toContain(
    "naak-bar-ultra",
  );

  await retirerDuMarche("naak-bar-ultra");

  expect((await listProducts()).map((p) => p.codeSeed)).not.toContain(
    "naak-bar-ultra",
  );
});

test("le catalogue se range par marque, puis par nom", async () => {
  const entrees = await listProducts();
  const cles = entrees.map((p) => `${p.brandName} ${p.name}`);

  expect(cles).toEqual([...cles].sort());
  expect(entrees.length).toBeGreaterThan(1);
});
