import { sql } from "drizzle-orm";
import type { AidStation, Flask, ResolvedPoint, Targets } from "@/core/type";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { flasks } from "@/db/schema/flasks";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
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

    return plan.accessId;
  });
}
