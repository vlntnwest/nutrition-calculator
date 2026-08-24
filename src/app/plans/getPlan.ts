import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { legs } from "@/db/schema/legs";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { tracks } from "@/db/schema/tracks";
import { warnings } from "@/db/schema/warnings";
import type { NewPlan } from "./createPlan";

/** Relit un plan par son identifiant d'accès. */
export async function getPlan(accessId: string): Promise<NewPlan | null> {
  const [row] = await db
    .select()
    .from(plans)
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .where(and(eq(plans.accessId, accessId), gt(plans.expiresAt, sql`now()`)));

  if (!row) {
    await deleteIfExpired(accessId);

    return null;
  }

  const [flaskRows, aidRows, productRows, overrideRows] = await Promise.all([
    db
      .select()
      .from(flasks)
      .where(eq(flasks.planId, accessId))
      .orderBy(flasks.rank),
    db
      .select()
      .from(aidStations)
      .where(eq(aidStations.planId, accessId))
      .orderBy(aidStations.positionM),
    db
      .select({ codeSeed: products.codeSeed })
      .from(productSnapshots)
      .innerJoin(products, eq(productSnapshots.productId, products.id))
      .where(eq(productSnapshots.planId, accessId))
      .orderBy(products.codeSeed),
    db
      .select()
      .from(legOverrides)
      .where(eq(legOverrides.planId, accessId))
      .orderBy(legOverrides.endPositionM),
  ]);

  const settings = row.plan_settings;

  return {
    track: {
      name: row.tracks.name,
      distanceM: row.tracks.distanceM,
      ascentM: row.tracks.ascentM,
      points: row.tracks.points,
    },
    settings: {
      massKg: settings.massKg,
      targetTimeS: settings.targetTimeS,
      climbIntensity: settings.climbIntensity,
      paceSplit: settings.paceSplit,
      raceDate: settings.raceDate,
      // La base rend `HH:MM:SS`, le contrat d'entrée est `HH:MM`.
      startTime: settings.startTime?.slice(0, 5),
      targets: {
        carbsGH: settings.targetCarbsGH,
        fluidMlH: settings.targetFluidMlH,
        sodiumMgL: settings.targetSodiumMgL,
      },
    },
    flasks: flaskRows.map((flask) => ({
      volumeMl: flask.volumeMl,
      onlyWater: flask.onlyWater,
    })),
    // Une sélection est un ensemble, pas une suite : l'ordre de saisie ne
    // porte rien tant que `parts` n'est pas exposé (§7). Rendu trié, donc.
    productCodes: productRows.map((p) => p.codeSeed),
    aidStations: aidRows.map((aid) => ({
      name: aid.name,
      distanceM: aid.positionM,
      stopS: aid.stopDurationS ?? undefined,
      // Absent et `true` disent la même chose : on ne rend que le cas notable.
      providesLiquid: aid.providesLiquid ? undefined : false,
    })),
    legOverrides: overrideRows.map((o) => ({
      endPositionM: o.endPositionM,
      durationS: o.durationOverrideS ?? undefined,
    })),
  };
}

/**
 * Suppression paresseuse — §11. Les avertissements globaux ont `leg_rank` à
 * null : aucune cascade ne les emporte, d'où le premier `delete`.
 */
async function deleteIfExpired(accessId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [expired] = await tx
      .select({ accessId: plans.accessId })
      .from(plans)
      .where(
        and(eq(plans.accessId, accessId), lte(plans.expiresAt, sql`now()`)),
      );

    if (!expired) return;

    await tx.delete(warnings).where(eq(warnings.planId, accessId));
    await tx.delete(legs).where(eq(legs.planId, accessId));
    await tx.delete(plans).where(eq(plans.accessId, accessId));
  });
}
