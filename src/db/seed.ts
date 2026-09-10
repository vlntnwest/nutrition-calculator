import { sql } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";
import { SAMPLE_PRODUCTS } from "@/fixtures/sampleProducts";

/**
 * Écrit le jeu d'essai en base, pour peupler un poste de développement ou la
 * base de test. Le catalogue, lui, se saisit par `/catalogue` et ne se sème
 * pas. Relançable : chaque table s'upserte sur sa clé naturelle — le nom pour
 * une marque, le libellé pour un format, `code_seed` pour un produit.
 */
export async function seed(): Promise<void> {
  await db.transaction(async (tx) => {
    const marques = [...new Set(SAMPLE_PRODUCTS.map((p) => p.brand))];
    const libelles = [...new Set(SAMPLE_PRODUCTS.map((p) => p.type))];

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

    for (const p of SAMPLE_PRODUCTS) {
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
