import { asc, eq, isNull } from "drizzle-orm";
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
  energyKcal: number;
  weightG: number;
  /** Nul pour ce qui ne s'avale pas avec de l'eau. */
  fluidMl: number | null;
  /** 2 pour ce qui se coupe en deux, 1 pour ce qui se finit. */
  divisibleBy: number;
  /** La marque annonce un mélange de sucres, glucose et fructose. */
  multiTransportable: boolean;
  purchaseUrl: string | null;
};

/**
 * Le catalogue, tel qu'un écran le propose.
 *
 * Les produits retirés du marché en sortent : un plan déjà enregistré les
 * garde en instantané, mais on n'en compose plus de nouveau.
 */
export async function listProducts(): Promise<CatalogueEntry[]> {
  return db
    .select({
      codeSeed: products.codeSeed,
      name: products.name,
      brandName: brands.name,
      formatLabel: formats.label,
      carbsG: products.carbsG,
      sodiumMg: products.sodiumMg,
      energyKcal: products.energyKcal,
      weightG: products.weightG,
      fluidMl: products.fluidMl,
      divisibleBy: products.divisibleBy,
      multiTransportable: products.multiTransportable,
      purchaseUrl: products.purchaseUrl,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .where(isNull(products.discontinuedAt))
    .orderBy(asc(brands.name), asc(products.name));
}
