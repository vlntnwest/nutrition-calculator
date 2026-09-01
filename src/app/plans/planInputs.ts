import { eq } from "drizzle-orm";
import { distributeTime } from "@/core/distribute";
import { fixedSpans, movingTimeS } from "@/core/nutrition";
import type {
  AidStation,
  Product,
  ProductType,
  Runner,
  Targets,
  TimedPoint,
} from "@/core/type";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { tracks } from "@/db/schema/tracks";
import { PlanError } from "./planError";
import { resolveTargets } from "./targets";

/** Tout ce que `nutritionPlan` attend, relu depuis un plan stocké. */
export type PlanInputs = {
  timed: TimedPoint[];
  stations: AidStation[];
  runner: Runner;
  targets: Targets;
  products: Product[];
  /** L'arrivée n'est fermée par aucun ravito : sa consigne passe à part. */
  finishTargets: Partial<Targets> | undefined;
};

/**
 * Les entrées du noyau, relues une seule fois.
 *
 * `regeneratePlan` et `saveRoadbook` partent toutes deux d'ici : deux lectures
 * séparées finiraient par diverger, et un plan enregistré ne se recalculerait
 * plus comme il se génère.
 *
 * L'identifiant d'un instantané sert de `Product.id` : les rations rendues par
 * le noyau se rattachent alors à leur ligne sans table de correspondance.
 */
export async function planInputs(accessId: string): Promise<PlanInputs> {
  const [row] = await db
    .select()
    .from(plans)
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .where(eq(plans.accessId, accessId));

  if (!row) throw new PlanError(`Unknown plan: ${accessId}`);

  const [flaskRows, aidRows, snapshots, overrideRows] = await Promise.all([
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
      .select()
      .from(productSnapshots)
      .where(eq(productSnapshots.planId, accessId)),
    db.select().from(legOverrides).where(eq(legOverrides.planId, accessId)),
  ]);

  const settings = row.plan_settings;

  if (settings.massKg === null || settings.targetTimeS === null) {
    throw new PlanError(`Plan not ready: missing mass or target time`);
  }

  const runner = {
    massKg: settings.massKg,
    flasks: flaskRows.map((f) => ({
      volumeMl: f.volumeMl,
      onlyWater: f.onlyWater,
    })),
  };
  // Une consigne se range sur l'abscisse où le secteur s'achève : le noyau la
  // porte sur le ravito qui l'y clôt, et à part pour l'arrivée.
  const imposed = new Map(
    overrideRows.map((o) => [o.endPositionM, o.durationOverrideS ?? undefined]),
  );
  // Les cibles imposées se rangent sur la même abscisse que les durées : la
  // borne de fin du secteur. Partielles — on ne remplace que ce qui est donné.
  const imposedTargets = new Map(
    overrideRows.map((o) => [
      o.endPositionM,
      {
        ...(o.carbsOverrideG_H === null ? {} : { carbsGH: o.carbsOverrideG_H }),
        ...(o.fluidOverrideMl_L === null
          ? {}
          : { fluidMlH: o.fluidOverrideMl_L }),
        ...(o.sodiumOverrideMg_L === null
          ? {}
          : { sodiumMgL: o.sodiumOverrideMg_L }),
      },
    ]),
  );
  const stations = aidRows.map((a) => ({
    name: a.name,
    distanceM: a.positionM,
    stopS: a.stopDurationS ?? undefined,
    legDurationS: imposed.get(a.positionM),
    legTargets: imposedTargets.get(a.positionM),
    providesLiquid: a.providesLiquid,
    providesSolid: a.providesSolid,
  }));
  const products: Product[] = snapshots.map((s) => ({
    id: s.id,
    brand: s.brandName ?? "",
    name: s.name,
    type: s.formatLabel as ProductType,
    weightG: s.weightG,
    energyKcal: s.energyKcal,
    carbsG: s.carbsG,
    sodiumMg: s.sodiumMg,
    fluidMl: s.fluidMl ?? 0,
    multiTransportable: s.multiTransportable,
    divisibleBy: s.divisibleBy,
  }));

  const profile = row.tracks.profile;
  const totalM = row.tracks.distanceM;
  const timed = distributeTime(
    profile,
    movingTimeS(settings.targetTimeS, stations, totalM),
    { climbIntensity: settings.climbIntensity, split: settings.paceSplit },
    fixedSpans(stations, totalM, imposed.get(totalM)),
  );
  const targets = resolveTargets(settings, runner, settings.targetTimeS);

  return {
    timed,
    stations,
    runner,
    targets,
    products,
    finishTargets: imposedTargets.get(totalM),
  };
}
