import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";

export type CatalogueEntry = {
  codeSeed: string;
  name: string;
  brandName: string;
  formatLabel: string;
  carbsG: number;
  sodiumMg: number;
  /** Nul pour ce qui ne s'avale pas avec de l'eau. */
  fluidMl: number | null;
};

/** Le catalogue, tel qu'un écran le propose. */
export async function listProducts(): Promise<CatalogueEntry[]> {
  return db
    .select({
      codeSeed: products.codeSeed,
      name: products.name,
      brandName: brands.name,
      formatLabel: formats.label,
      carbsG: products.carbsG,
      sodiumMg: products.sodiumMg,
      fluidMl: products.fluidMl,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .orderBy(asc(formats.label), asc(brands.name), asc(products.name));
}
