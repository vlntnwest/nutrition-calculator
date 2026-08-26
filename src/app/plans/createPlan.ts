import { eq, inArray, sql } from "drizzle-orm";
import type { Flask, ResolvedPoint, Targets } from "@/core/type";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { brands } from "@/db/schema/brands";
import { flasks } from "@/db/schema/flasks";
import { formats } from "@/db/schema/formats";
import { legOverrides } from "@/db/schema/legOverrides";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { tracks } from "@/db/schema/tracks";

/** Un ravito, tel qu'il se saisit. Ce qu'il impose au secteur est à part. */
export type NewAidStation = {
  name: string;
  distanceM: number;
  /** L'arrêt sur place, en secondes. */
  stopS?: number;
  /** Y trouve-t-on de l'eau ? Absent vaut oui. */
  providesLiquid?: boolean;
  /** Y trouve-t-on de quoi manger ? Absent vaut oui. */
  providesSolid?: boolean;
};

/**
 * Ce qui est imposé au secteur se terminant à `endPositionM` — la position
 * d'un ravito, ou la distance totale pour l'arrivée, que rien ne clôt.
 */
export type LegOverride = {
  endPositionM: number;
  durationS?: number;
};

/** Le côté saisie d'un plan. Le calculé naît de la régénération. */
export type NewPlan = {
  track: {
    name: string;
    distanceM: number;
    ascentM: number;
    points: ResolvedPoint[];
  };
  settings: {
    massKg?: number;
    targetTimeS?: number;
    climbIntensity: number;
    paceSplit: number;
    /** `AAAA-MM-JJ` */
    raceDate?: string;
    /** `HH:MM` */
    startTime?: string;
    targets: Targets;
  };
  flasks: Flask[];
  aidStations: NewAidStation[];
  /** Ce qui est imposé aux secteurs. Voir `LegOverride`. */
  legOverrides: LegOverride[];
  /** Les `code_seed` des produits retenus — « naak-gel-ultra ». */
  productCodes: string[];
};

/**
 * L'écart minimal entre deux bornes d'un secteur, en mètres.
 *
 * Deux ravitos collés fabriquent un secteur qui s'arrondit à zéro seconde et
 * viole `legs_duration_positive` à la régénération. On refuse ici plutôt que
 * de laisser remonter une erreur Postgres brute — et un secteur de quelques
 * mètres n'a de toute façon aucun sens pour un coureur.
 */
const MIN_LEG_M = 1000;

/**
 * Les bornes trop rapprochées, s'il y en a. Le départ et l'arrivée en font
 * partie : un ravito collé à l'un des deux fabrique le même secteur nul.
 */
function tooClose(input: NewPlan): [number, number] | null {
  const bounds = [
    0,
    ...input.aidStations.map((aid) => aid.distanceM).sort((a, b) => a - b),
    input.track.distanceM,
  ];

  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i] - bounds[i - 1] < MIN_LEG_M)
      return [bounds[i - 1], bounds[i]];
  }

  return null;
}

/** Écrit un plan et rend son identifiant d'accès. */
export async function createPlan(input: NewPlan): Promise<string> {
  const collees = tooClose(input);
  if (collees) {
    throw new Error(
      `Aid stations too close: ${collees[0]} m et ${collees[1]} m ` +
        `(minimum ${MIN_LEG_M} m)`,
    );
  }

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
      massKg: input.settings.massKg ?? null,
      targetTimeS: input.settings.targetTimeS ?? null,
      climbIntensity: input.settings.climbIntensity,
      paceSplit: input.settings.paceSplit,
      raceDate: input.settings.raceDate ?? null,
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
          providesLiquid: aid.providesLiquid ?? true,
          providesSolid: aid.providesSolid ?? true,
        })),
      );
    }

    const overrides = input.legOverrides;
    if (overrides.length > 0) {
      // Une borne inconnue serait ignorée sans bruit à la régénération : aucune
      // clé étrangère ne peut la tenir, l'arrivée n'étant pas un ravito.
      const bornes = new Set([
        ...input.aidStations.map((aid) => aid.distanceM),
        input.track.distanceM,
      ]);
      const perdus = overrides.filter((o) => !bornes.has(o.endPositionM));

      if (perdus.length > 0) {
        throw new Error(
          `Leg overrides at unknown boundaries: ${perdus
            .map((o) => o.endPositionM)
            .join(", ")}`,
        );
      }

      await tx.insert(legOverrides).values(
        overrides.map((o) => ({
          planId: plan.accessId,
          endPositionM: o.endPositionM,
          durationOverrideS: o.durationS ?? null,
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
