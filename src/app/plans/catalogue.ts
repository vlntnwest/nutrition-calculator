import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";
import { MARQUE_PERSO } from "@/format/produit";

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
  /** Saisi par le coureur pour ce plan, absent du catalogue des autres. */
  own: boolean;
};

/**
 * Le catalogue, tel qu'un écran le propose.
 *
 * Les produits retirés du marché en sortent : un plan déjà enregistré les
 * garde en instantané, mais on n'en compose plus de nouveau.
 *
 * Avec `planId`, ceux que le coureur a saisis pour cette course s'y ajoutent,
 * en tête : ce sont eux qu'il vient chercher. Sans lui, le catalogue seul,
 * tel que `/catalogue` le tient. Les produits d'un autre plan ne sortent
 * jamais. ADR 015.
 */
export async function listProducts(planId?: string): Promise<CatalogueEntry[]> {
  const rows = await db
    .select({
      codeSeed: products.codeSeed,
      name: products.name,
      brandName: sql<
        string | null
      >`coalesce(${brands.name}, ${products.ownBrand})`,
      formatLabel: formats.label,
      carbsG: products.carbsG,
      sodiumMg: products.sodiumMg,
      energyKcal: products.energyKcal,
      weightG: products.weightG,
      fluidMl: products.fluidMl,
      divisibleBy: products.divisibleBy,
      multiTransportable: products.multiTransportable,
      purchaseUrl: products.purchaseUrl,
      own: sql<boolean>`${products.planId} is not null`,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .where(
      and(
        isNull(products.discontinuedAt),
        planId === undefined
          ? isNull(products.planId)
          : or(isNull(products.planId), eq(products.planId, planId)),
      ),
    )
    .orderBy(
      sql`${products.planId} is null`,
      sql`coalesce(${brands.name}, ${products.ownBrand}) nulls first`,
      asc(products.name),
    );

  return rows.map((row) => ({
    ...row,
    brandName: row.brandName ?? MARQUE_PERSO,
  }));
}

/** Les formats que la base connaît, pour la saisie d'un produit. */
export async function listFormats(): Promise<string[]> {
  const rows = await db
    .select({ label: formats.label })
    .from(formats)
    .orderBy(asc(formats.label));

  return rows.map((row) => row.label);
}
