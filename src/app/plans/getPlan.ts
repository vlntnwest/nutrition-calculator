import {
  and,
  eq,
  getTableColumns,
  gt,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
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
import type { StoredPlan } from "./planInput";

/**
 * Le plan n'a pas expiré — ou ne peut pas expirer.
 *
 * Une date nulle est celle d'un plan modèle : la copie qu'on en tire, elle,
 * porte les six mois de tout le monde.
 *
 * Exportée pour `planSummaries`, qui lit plusieurs plans d'un coup : la règle
 * d'expiration ne s'écrit qu'ici, sans quoi une liste montrerait des plans que
 * la lecture, elle, refuse d'ouvrir.
 */
export const alive = or(
  isNull(plans.expiresAt),
  gt(plans.expiresAt, sql`now()`),
);

/**
 * Relit un plan par son identifiant d'accès, **sans sa géométrie**.
 *
 * La projection est explicite parce que `points` et `profile` sont dans la
 * même ligne que le nom et la distance : un `select()` nu les emporte, et un
 * écran qui n'affiche qu'un formulaire paie alors le mégaoctet de la trace à
 * chaque navigation. Qui dessine appelle `getTrackPoints` — voir `getTrack`.
 */
export async function getPlan(accessId: string): Promise<StoredPlan | null> {
  const [row] = await db
    .select({
      track: {
        name: tracks.name,
        distanceM: tracks.distanceM,
        ascentM: tracks.ascentM,
      },
      settings: getTableColumns(planSettings),
    })
    .from(plans)
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .where(and(eq(plans.accessId, accessId), alive));

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

  const settings = row.settings;

  return {
    track: row.track,
    settings: {
      massKg: settings.massKg ?? undefined,
      targetTimeS: settings.targetTimeS ?? undefined,
      climbEffort: settings.climbEffort,
      paceSplit: settings.paceSplit,
      raceDate: settings.raceDate ?? undefined,
      // La base rend `HH:MM:SS`, le contrat d'entrée est `HH:MM`.
      startTime: settings.startTime?.slice(0, 5),
      // Les trois s'écrivent ensemble : nulles, la question ne s'est pas
      // encore posée — ce n'est pas la même chose que d'avoir répondu bas.
      targets:
        settings.targetCarbsGH === null ||
        settings.targetFluidMlH === null ||
        settings.targetSodiumMgL === null
          ? undefined
          : {
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
      providesSolid: aid.providesSolid ? undefined : false,
    })),
    legOverrides: overrideRows.map((o) => ({
      endPositionM: o.endPositionM,
      durationS: o.durationOverrideS ?? undefined,
      // Absent plutôt que vide : trois colonnes nulles veulent dire « aucune
      // cible imposée », pas « des cibles vides ».
      targets:
        o.carbsOverrideG_H === null &&
        o.fluidOverrideMl_L === null &&
        o.sodiumOverrideMg_L === null
          ? undefined
          : {
              ...(o.carbsOverrideG_H === null
                ? {}
                : { carbsGH: o.carbsOverrideG_H }),
              ...(o.fluidOverrideMl_L === null
                ? {}
                : { fluidMlH: o.fluidOverrideMl_L }),
              ...(o.sodiumOverrideMg_L === null
                ? {}
                : { sodiumMgL: o.sodiumOverrideMg_L }),
            },
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
