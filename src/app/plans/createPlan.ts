import { eq, inArray, sql } from "drizzle-orm";
import type { AidStation, Flask, ResolvedPoint, Targets } from "@/core/type";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { brands } from "@/db/schema/brands";
import { flasks } from "@/db/schema/flasks";
import { formats } from "@/db/schema/formats";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { tracks } from "@/db/schema/tracks";

/** Le côté saisie d'un plan. Le calculé naît de la régénération. */
export type NewPlan = {
  track: {
    name: string;
    distanceM: number;
    ascentM: number;
    points: ResolvedPoint[];
  };
  settings: {
    massKg: number;
    targetTimeS: number;
    ascentOverrideM?: number;
    climbIntensity: number;
    paceSplit: number;
    /** `AAAA-MM-JJ` */
    raceDate: string;
    /** `HH:MM` */
    startTime?: string;
    targets: Targets;
  };
  flasks: Flask[];
  aidStations: AidStation[];
  /** Les `code_seed` des produits retenus — « naak-gel-ultra ». */
  productCodes: string[];
};

/** Écrit un plan et rend son identifiant d'accès. */
export async function createPlan(input: NewPlan): Promise<string> {
  return db.transaction(async (tx) => {
    // `greatest` couvre la course déjà passée, qui garde six mois pleins.
    const [plan] = await tx
      .insert(plans)
      .values({
        expiresAt: sql`greatest(now(), ${input.settings.raceDate}::timestamptz) + interval '6 months'`,
      })
      .returning({ accessId: plans.accessId });

    await tx.insert(tracks).values({
      planId: plan.accessId,
      name: input.track.name,
      distanceM: input.track.distanceM,
      ascentM: input.track.ascentM,
      points: input.track.points,
    });

    await tx.insert(planSettings).values({
      planId: plan.accessId,
      massKg: input.settings.massKg,
      targetTimeS: input.settings.targetTimeS,
      ascentOverrideM: input.settings.ascentOverrideM ?? null,
      climbIntensity: input.settings.climbIntensity,
      paceSplit: input.settings.paceSplit,
      raceDate: input.settings.raceDate,
      startTime: input.settings.startTime ?? null,
      targetCarbsGH: input.settings.targets.carbsGH,
      targetFluidMlH: input.settings.targets.fluidMlH,
      targetSodiumMgL: input.settings.targets.sodiumMgL,
    });

    // Tableau vide = cas nominal du §3, et Drizzle refuse `values([])`.
    // Le noyau indexe les flasques à 0, la base numérote à partir de 1.
    if (input.flasks.length > 0) {
      await tx.insert(flasks).values(
        input.flasks.map((flask, i) => ({
          planId: plan.accessId,
          rank: i + 1,
          volumeMl: flask.volumeMl,
          onlyWater: flask.onlyWater,
        })),
      );
    }

    if (input.aidStations.length > 0) {
      await tx.insert(aidStations).values(
        input.aidStations.map((aid) => ({
          planId: plan.accessId,
          positionM: aid.distanceM,
          name: aid.name,
          stopDurationS: aid.stopS ?? null,
          durationOverrideS: aid.legDurationS ?? null,
        })),
      );
    }

    if (input.productCodes.length > 0) {
      const catalogue = await tx
        .select()
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .innerJoin(formats, eq(products.formatId, formats.id))
        .where(inArray(products.codeSeed, input.productCodes));

      if (catalogue.length !== input.productCodes.length) {
        const connus = new Set(catalogue.map((r) => r.products.codeSeed));
        const manquants = input.productCodes.filter((c) => !connus.has(c));

        throw new Error(`Unknown product codes: ${manquants.join(", ")}`);
      }

      // Figés à la sélection : corriger le catalogue ne réécrit jamais un plan
      // enregistré. `divisibleBy` et `multiTransportable` en font partie, ils
      // entrent tous deux dans le calcul.
      await tx.insert(productSnapshots).values(
        catalogue.map(({ products: p, brands: b, formats: f }) => ({
          planId: plan.accessId,
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

    return plan.accessId;
  });
}
