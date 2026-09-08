"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type NewProduct = {
  codeSeed: string;
  brandName: string;
  formatLabel: string;
  name: string;
  weightG: number;
  energyKcal: number;
  carbsG: number;
  sodiumMg: number;
  caffeineMg: number;
  fluidMl: number;
  proteinG: number | undefined;
  fiberG: number | undefined;
  sugarG: number | undefined;
  fatG: number | undefined;
  purchaseUrl: string | undefined;
  divisibleBy: 1 | 2;
  multiTransportable: boolean;
};

/**
 * Ajoute un produit au catalogue. Marque et format viennent déjà de la base
 * — la page ne propose que ce que leurs listes déroulantes connaissent — donc
 * seul l'identifiant peut encore se heurter à une contrainte.
 */
export async function addProduct(input: NewProduct): Promise<Result<null>> {
  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.name, input.brandName));
  const [format] = await db
    .select({ id: formats.id })
    .from(formats)
    .where(eq(formats.label, input.formatLabel));

  if (!brand || !format) {
    return { ok: false, error: "Marque ou format introuvable." };
  }

  try {
    await db.insert(products).values({
      codeSeed: input.codeSeed,
      brandId: brand.id,
      formatId: format.id,
      name: input.name,
      weightG: input.weightG,
      energyKcal: input.energyKcal,
      carbsG: input.carbsG,
      sodiumMg: input.sodiumMg,
      caffeineMg: input.caffeineMg,
      fluidMl: input.fluidMl,
      proteinG: input.proteinG,
      fiberG: input.fiberG,
      sugarG: input.sugarG,
      fatG: input.fatG,
      purchaseUrl: input.purchaseUrl,
      divisibleBy: input.divisibleBy,
      multiTransportable: input.multiTransportable,
    });

    return { ok: true, value: null };
  } catch (error) {
    return { ok: false, error: messageErreur(error) };
  }
}

/**
 * Une contrainte Postgres nomme des colonnes, ce qui ne dit rien à qui
 * remplit le formulaire. On ne traduit que celles qu'une saisie à la main
 * peut vraiment heurter, le reste reste une panne journalisée.
 */
function messageErreur(error: unknown): string {
  switch (contrainteViolee(error)) {
    case "products_code_seed_key":
      return "Cet identifiant existe déjà.";
    case "products_code_seed_format":
      return "L'identifiant se limite aux minuscules, chiffres et tirets.";
    case "products_energy_carbs_ratio":
      return "L'énergie déclarée ne colle pas aux glucides — vérifiez les deux valeurs.";
    case "products_carbs_positive":
      return "Les glucides doivent être positifs.";
    case "product_protein_g_positive":
      return "Les protéines doivent être positives.";
    case "product_fiber_g_positive":
      return "Les fibres doivent être positives.";
    case "product_fat_g_positive":
      return "Les lipides doivent être positifs.";
    case "product_caffeine_mg_positive":
      return "La caféine doit être positive.";
    case "product_sugar_g_positive":
      return "Le sucre doit être positif.";
    case "sugar_g_lte_carbs_g":
      return "Le sucre ne peut pas dépasser les glucides.";
    default:
      console.error("ajout produit échoué", error);

      return "Une erreur inattendue est survenue.";
  }
}

/**
 * Drizzle enveloppe l'erreur pg dans une `DrizzleQueryError` : le nom de la
 * contrainte voyage sur `cause`, pas sur l'erreur elle-même.
 */
function contrainteViolee(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  if ("constraint" in error && typeof error.constraint === "string") {
    return error.constraint;
  }

  return "cause" in error ? contrainteViolee(error.cause) : undefined;
}
