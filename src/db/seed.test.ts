import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { CATALOG } from "@/core/products";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";
import { seed } from "./seed";

const marques = new Set(CATALOG.map((p) => p.brand)).size;
const formatsAttendus = new Set(CATALOG.map((p) => p.type)).size;

test("deux passages du seed ne laissent qu'un seul catalogue", async () => {
  await seed();
  await seed();

  expect(await db.select().from(products)).toHaveLength(CATALOG.length);
  expect(await db.select().from(brands)).toHaveLength(marques);
  expect(await db.select().from(formats)).toHaveLength(formatsAttendus);
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
