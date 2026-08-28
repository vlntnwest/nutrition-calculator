import { eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { legs } from "@/db/schema/legs";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { warnings } from "@/db/schema/warnings";
import { getPlan } from "./getPlan";
import { PlanError } from "./planError";
import type { NewPlan } from "./planInput";
import {
  assertValid,
  insertSnapshots,
  normalise,
  settingsColumns,
} from "./planInput";

/**
 * Ce qu'un écran renvoie d'un plan déjà écrit.
 *
 * Section absente : on n'y touche pas. Section présente : elle remplace
 * l'ancienne en entier — un tableau vide efface donc. Les réglages se
 * fusionnent champ par champ, `targets` restant un bloc : les trois cibles
 * bougent ensemble. La trace n'est pas de la mise à jour ; un autre GPX est
 * un autre plan.
 */
export type PlanPatch = Partial<Omit<NewPlan, "track" | "settings">> & {
  settings?: Partial<NewPlan["settings"]>;
};

/**
 * Réécrit le côté saisie d'un plan et jette le calcul qui en découlait.
 *
 * Le calcul ne survit pas : `legs` part en premier — c'est aussi ce qui
 * libère les ravitos et les instantanés, que des clés étrangères sans
 * cascade retiennent — et `generated_at` retombe à null. Régénérer est la
 * décision de l'appelant.
 */
export async function updatePlan(
  accessId: string,
  patch: PlanPatch,
): Promise<void> {
  const current = await getPlan(accessId);
  if (!current) throw new PlanError(`Unknown plan: ${accessId}`);

  const merged: NewPlan = normalise({
    track: current.track,
    settings: { ...current.settings, ...patch.settings },
    flasks: patch.flasks ?? current.flasks,
    aidStations: patch.aidStations ?? current.aidStations,
    legOverrides: patch.legOverrides ?? current.legOverrides,
    productCodes: patch.productCodes ?? current.productCodes,
  });

  // Sur le plan entier, jamais sur le patch : déplacer un ravito peut faire
  // tomber à côté une consigne que le patch ne porte même pas.
  assertValid(merged);

  await db.transaction(async (tx) => {
    // Les avertissements globaux portent `leg_rank` à null : aucune cascade
    // ne les emporte, d'où le premier `delete`. Les rations et remplissages
    // suivent les secteurs.
    await tx.delete(warnings).where(eq(warnings.planId, accessId));
    await tx.delete(legs).where(eq(legs.planId, accessId));

    if (patch.settings) {
      await tx
        .update(planSettings)
        .set(settingsColumns(merged.settings))
        .where(eq(planSettings.planId, accessId));
    }

    if (patch.flasks) {
      await tx.delete(flasks).where(eq(flasks.planId, accessId));
      if (merged.flasks.length > 0) {
        await tx.insert(flasks).values(
          merged.flasks.map((flask, i) => ({
            planId: accessId,
            rank: i + 1,
            volumeMl: flask.volumeMl,
            onlyWater: flask.onlyWater,
          })),
        );
      }
    }

    if (patch.aidStations) {
      await tx.delete(aidStations).where(eq(aidStations.planId, accessId));
      if (merged.aidStations.length > 0) {
        await tx.insert(aidStations).values(
          merged.aidStations.map((aid) => ({
            planId: accessId,
            positionM: aid.distanceM,
            name: aid.name,
            stopDurationS: aid.stopS ?? null,
            providesLiquid: aid.providesLiquid ?? true,
            providesSolid: aid.providesSolid ?? true,
          })),
        );
      }
    }

    if (patch.legOverrides) {
      await tx.delete(legOverrides).where(eq(legOverrides.planId, accessId));
      if (merged.legOverrides.length > 0) {
        await tx.insert(legOverrides).values(
          merged.legOverrides.map((o) => ({
            planId: accessId,
            endPositionM: o.endPositionM,
            durationOverrideS: o.durationS ?? null,
            carbsOverrideG_H: o.targets?.carbsGH ?? null,
            fluidOverrideMl_L: o.targets?.fluidMlH ?? null,
            sodiumOverrideMg_L: o.targets?.sodiumMgL ?? null,
          })),
        );
      }
    }

    if (patch.productCodes) await syncSnapshots(tx, accessId, merged);

    await tx
      .update(plans)
      .set({
        lastSavedAt: sql`now()`,
        generatedAt: null,
        expiresAt: sql`greatest(now(), ${merged.settings.raceDate ?? null}::timestamptz) + interval '6 months'`,
      })
      .where(eq(plans.accessId, accessId));
  });
}

/**
 * Aligne les instantanés sur la sélection, sans toucher à ceux qui restent.
 *
 * Les remplacer en bloc les regèlerait sur le catalogue du jour : ajouter un
 * produit trois semaines plus tard réécrirait les autres. On ne bouge donc
 * que les entrants et les sortants.
 */
async function syncSnapshots(
  tx: Tx,
  accessId: string,
  merged: NewPlan,
): Promise<void> {
  const existants = await tx
    .select({ id: productSnapshots.id, codeSeed: products.codeSeed })
    .from(productSnapshots)
    .innerJoin(products, eq(productSnapshots.productId, products.id))
    .where(eq(productSnapshots.planId, accessId));

  const voulus = new Set(merged.productCodes);
  const partants = existants.filter((s) => !voulus.has(s.codeSeed));
  if (partants.length > 0) {
    await tx.delete(productSnapshots).where(
      inArray(
        productSnapshots.id,
        partants.map((s) => s.id),
      ),
    );
  }

  const dejaLa = new Set(existants.map((s) => s.codeSeed));
  const arrivants = merged.productCodes.filter((c) => !dejaLa.has(c));

  await insertSnapshots(tx, accessId, arrivants);
}
