import { eq, inArray } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";
import { SAMPLE_PRODUCTS } from "@/fixtures/sampleProducts";
import { seed } from "./seed";

const codes = SAMPLE_PRODUCTS.map((p) => p.id);
const marques = [...new Set(SAMPLE_PRODUCTS.map((p) => p.brand))];
const libelles = [...new Set(SAMPLE_PRODUCTS.map((p) => p.type))];

test("deux passages du seed ne laissent qu'un seul jeu d'essai", async () => {
  await seed();
  await seed();

  // Sur les lignes du seed seules : les tables portent aussi ce que
  // l'application y ajoute, et compter tout reviendrait à l'interdire.
  expect(
    await db.select().from(products).where(inArray(products.codeSeed, codes)),
  ).toHaveLength(codes.length);
  expect(
    await db.select().from(brands).where(inArray(brands.name, marques)),
  ).toHaveLength(marques.length);
  expect(
    await db.select().from(formats).where(inArray(formats.label, libelles)),
  ).toHaveLength(libelles.length);
});

test("un produit retrouve sa marque, son format et ses valeurs", async () => {
  await seed();

  const [row] = await db
    .select()
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .where(eq(products.codeSeed, "naak-gel-ultra"));

  expect(row.brands.name).toBe("Näak");
  expect(row.formats.label).toBe("gel");
  expect(row.products).toMatchObject({
    name: "Ultra Energy Gel",
    energyKcal: 200,
    weightG: 57,
    carbsG: 27,
    sodiumMg: 190,
    fluidMl: 0,
    divisibleBy: 1,
    multiTransportable: true,
  });
});
