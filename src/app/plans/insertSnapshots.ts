import { eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { PlanError } from "./planError";

/**
 * Fige les produits demandés dans le plan.
 *
 * Figés à la sélection : corriger le catalogue ne réécrit jamais un plan
 * enregistré. `divisibleBy` et `multiTransportable` en font partie, ils
 * entrent tous deux dans le calcul.
 */
export async function insertSnapshots(
  tx: Tx,
  planId: string,
  codes: string[],
): Promise<void> {
  // Les produits retenus sont un ensemble, pas une suite : un code répété
  // désigne le même produit. Compté deux fois, il faisait échouer le plan
  // entier sur un message qui ne nommait aucun produit.
  const voulus = [...new Set(codes)];

  if (voulus.length === 0) return;

  const catalogue = await tx
    .select()
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .where(inArray(products.codeSeed, voulus));

  if (catalogue.length !== voulus.length) {
    const connus = new Set(catalogue.map((r) => r.products.codeSeed));
    const manquants = voulus.filter((c) => !connus.has(c));

    throw new PlanError(`Unknown product codes: ${manquants.join(", ")}`);
  }

  await tx.insert(productSnapshots).values(
    catalogue.map(({ products: p, brands: b, formats: f }) => ({
      planId,
      productId: p.id,
      name: p.name,
      brandName: b.name,
      formatLabel: f.label,
      energyKcal: p.energyKcal,
      carbsG: p.carbsG,
      proteinG: p.proteinG,
      fatG: p.fatG,
      fiberG: p.fiberG,
      sugarG: p.sugarG,
      sodiumMg: p.sodiumMg,
      caffeineMg: p.caffeineMg,
      fluidMl: p.fluidMl,
      weightG: p.weightG,
      divisibleBy: p.divisibleBy,
      multiTransportable: p.multiTransportable,
    })),
  );
}
