import { sql } from "drizzle-orm";
import { CATALOG } from "@/core/products";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";

/**
 * Écrit le catalogue de `core/products.ts` en base. Relançable : chaque table
 * s'upserte sur sa clé naturelle — le nom pour une marque, le libellé pour un
 * format, `code_seed` pour un produit.
 */
export async function seed(): Promise<void> {
  await db.transaction(async (tx) => {
    const marques = [...new Set(CATALOG.map((p) => p.brand))];
    const libelles = [...new Set(CATALOG.map((p) => p.type))];

    const brandRows = await tx
      .insert(brands)
      .values(marques.map((name) => ({ name })))
      .onConflictDoUpdate({
        target: brands.name,
        set: { name: sql`excluded.name` },
      })
      .returning({ id: brands.id, name: brands.name });

    const formatRows = await tx
      .insert(formats)
      .values(libelles.map((label) => ({ label })))
      .onConflictDoUpdate({
        target: formats.label,
        set: { label: sql`excluded.label` },
      })
      .returning({ id: formats.id, label: formats.label });

    const brandId = new Map(brandRows.map((b) => [b.name, b.id]));
    const formatId = new Map(formatRows.map((f) => [f.label, f.id]));

    for (const p of CATALOG) {
      const values = {
        codeSeed: p.id,
        brandId: brandId.get(p.brand) as string,
        formatId: formatId.get(p.type) as string,
        name: p.name,
        energyKcal: p.energyKcal,
        weightG: p.weightG,
        carbsG: p.carbsG,
        sodiumMg: p.sodiumMg,
        caffeineMg: 0,
        fluidMl: p.fluidMl,
        divisibleBy: p.divisibleBy,
        multiTransportable: p.multiTransportable,
      };

      await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.codeSeed, set: values });
    }
  });
}
