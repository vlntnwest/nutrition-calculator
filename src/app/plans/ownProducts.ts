import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { formats } from "@/db/schema/formats";
import { products } from "@/db/schema/products";
import { getPlan } from "./getPlan";
import { PlanError } from "./planError";
import { updatePlan } from "./updatePlan";

/**
 * Un produit tel que le coureur le saisit pour sa course. Les valeurs sont
 * celles d'une dose, comme au catalogue.
 */
export type OwnProductInput = {
  name: string;
  /** Vide ou absente : le produit s'affiche sous « Perso ». */
  brandName?: string;
  formatLabel: string;
  weightG: number;
  carbsG: number;
  sodiumMg: number;
  /** Absente : quatre kilocalories par gramme de glucides. */
  energyKcal?: number;
  /** Le volume une fois préparée. Ne compte que pour une boisson. */
  fluidMl?: number;
  caffeineMg?: number;
  divisibleBy: 1 | 2;
  multiTransportable: boolean;
};

/**
 * Le nombre de produits qu'un plan peut porter en propre. L'action est une
 * route ouverte à qui tient l'identifiant : sans borne, elle remplirait la
 * table sans que personne ne coure.
 */
export const MAX_OWN_PRODUCTS = 30;

const NOM_MAX = 80;

/**
 * Ajoute au plan un produit qui n'est pas au catalogue, et rend son code.
 *
 * Il ne va pas au sac d'ici : l'écran l'y pose par l'écriture de tout le
 * monde, `productCodes`, qui fige l'instantané et applique ses règles.
 *
 * Le code n'est pas choisi par le coureur. `code_seed` est unique sur toute
 * la table, et un nom tapé à la main y heurterait celui d'un inconnu.
 */
export async function addOwnProduct(
  accessId: string,
  input: OwnProductInput,
): Promise<string> {
  const valeurs = lire(input);

  if (!(await getPlan(accessId))) {
    throw new PlanError(`Unknown plan: ${accessId}`);
  }

  const [format] = await db
    .select({ id: formats.id })
    .from(formats)
    .where(eq(formats.label, valeurs.formatLabel));
  if (!format) throw new PlanError("Choisissez un format dans la liste.");

  const [{ deja }] = await db
    .select({ deja: count() })
    .from(products)
    .where(eq(products.planId, accessId));
  if (deja >= MAX_OWN_PRODUCTS) {
    throw new PlanError(
      `Un plan porte ${MAX_OWN_PRODUCTS} produits saisis au plus. Supprimez-en un pour en ajouter un autre.`,
    );
  }

  const codeSeed = `perso-${randomUUID()}`;
  const { formatLabel: _format, ...colonnes } = valeurs;

  await db
    .insert(products)
    .values({ ...colonnes, codeSeed, planId: accessId, formatId: format.id });

  return codeSeed;
}

/**
 * Supprime un produit que le plan porte en propre.
 *
 * Il sort d'abord du sac : son instantané le retient, et les rations d'un
 * plan calculé retiennent l'instantané. `updatePlan` sait défaire les deux,
 * calcul compris. Un code du catalogue, ou celui d'un autre plan, ne trouve
 * rien ici et ne supprime rien.
 */
export async function removeOwnProduct(
  accessId: string,
  codeSeed: string,
): Promise<void> {
  const plan = await getPlan(accessId);
  if (!plan) throw new PlanError(`Unknown plan: ${accessId}`);

  await db.transaction(async (tx) => {
    const [own] = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.codeSeed, codeSeed), eq(products.planId, accessId)),
      );
    // Déjà parti : un double clic ne mérite pas un refus.
    if (!own) return;

    if (plan.productCodes.includes(codeSeed)) {
      await updatePlan(
        accessId,
        { productCodes: plan.productCodes.filter((c) => c !== codeSeed) },
        tx,
      );
    }

    await tx.delete(products).where(eq(products.id, own.id));
  });
}

/**
 * Contrôle la saisie et la ramène à ce que la base stocke.
 *
 * Tout se vérifie ici plutôt qu'à la contrainte Postgres : l'action reçoit
 * ce qu'on veut bien lui envoyer, et un refus doit dire quoi corriger.
 */
function lire(input: OwnProductInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") throw new PlanError("Donnez un nom au produit.");
  if (name.length > NOM_MAX) {
    throw new PlanError(`Le nom tient en ${NOM_MAX} caractères au plus.`);
  }

  const ownBrand =
    typeof input.brandName === "string" ? input.brandName.trim() : "";
  if (ownBrand.length > NOM_MAX) {
    throw new PlanError(`La marque tient en ${NOM_MAX} caractères au plus.`);
  }

  const carbsG = dixieme(input.carbsG);
  if (carbsG === undefined || carbsG <= 0) {
    throw new PlanError("Indiquez les glucides d'une dose, en grammes.");
  }
  // La colonne garde trois chiffres dont une décimale.
  if (carbsG >= 100) {
    throw new PlanError(
      "Une dose porte moins de 100 g de glucides. Saisissez une dose plus petite.",
    );
  }

  const weightG = entier(input.weightG, 5000);
  if (weightG === undefined || weightG === 0) {
    throw new PlanError("Indiquez le poids d'une dose, en grammes.");
  }

  const sodiumMg = entier(input.sodiumMg, 10000);
  if (sodiumMg === undefined) {
    throw new PlanError(
      "Indiquez le sodium d'une dose, en milligrammes. 0 s'il n'y en a pas.",
    );
  }

  const energyKcal =
    input.energyKcal === undefined
      ? Math.round(carbsG * 4)
      : entier(input.energyKcal, 5000);
  // La même règle que `products_energy_carbs_ratio`, à dix pour cent près.
  if (energyKcal === undefined || carbsG * 4 > energyKcal * 1.1) {
    throw new PlanError(
      "L'énergie ne colle pas aux glucides : un gramme en apporte quatre kilocalories. Vérifiez les deux valeurs.",
    );
  }

  const caffeineMg =
    input.caffeineMg === undefined ? 0 : entier(input.caffeineMg, 1000);
  if (caffeineMg === undefined) {
    throw new PlanError(
      "Indiquez la caféine en milligrammes, ou laissez vide.",
    );
  }

  // Seule une boisson se prépare dans un volume : ailleurs il vaut zéro, quoi
  // que l'écran ait gardé d'un format choisi puis abandonné.
  const boisson = input.formatLabel === "drink";
  const fluidMl = boisson ? entier(input.fluidMl, 3000) : 0;
  if (fluidMl === undefined || (boisson && fluidMl === 0)) {
    throw new PlanError(
      "Indiquez le volume d'eau dans lequel la dose se prépare, en millilitres.",
    );
  }

  return {
    name,
    ownBrand: ownBrand === "" ? null : ownBrand,
    formatLabel: String(input.formatLabel),
    weightG,
    carbsG,
    sodiumMg,
    energyKcal,
    caffeineMg,
    fluidMl,
    divisibleBy: input.divisibleBy === 2 ? 2 : 1,
    multiTransportable: input.multiTransportable === true,
  };
}

/** Un entier positif sous `max`, ou rien si la valeur n'en est pas un. */
function entier(valeur: unknown, max: number): number | undefined {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return undefined;

  const arrondi = Math.round(valeur);

  return arrondi >= 0 && arrondi <= max ? arrondi : undefined;
}

/** Au dixième, la précision de la colonne. */
function dixieme(valeur: unknown): number | undefined {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return undefined;

  return Math.round(valeur * 10) / 10;
}
