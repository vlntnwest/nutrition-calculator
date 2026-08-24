import { eq, sql } from "drizzle-orm";
import { distributeTime } from "@/core/distribute";
import { fixedSpans, movingTimeS, nutritionPlan } from "@/core/nutrition";
import type { NutritionPlan, Product, ProductType } from "@/core/type";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { fill } from "@/db/schema/fill";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { legs } from "@/db/schema/legs";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { tracks } from "@/db/schema/tracks";
import { warnings } from "@/db/schema/warnings";

/**
 * Recalcule le plan et réécrit tout le côté droit du modèle.
 *
 * L'identifiant d'un instantané sert de `Product.id` : les rations rendues par
 * le noyau se rattachent alors à leur ligne sans table de correspondance.
 */
export async function regeneratePlan(accessId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(plans)
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .where(eq(plans.accessId, accessId));

  if (!row) throw new Error(`Unknown plan: ${accessId}`);

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
  const stations = aidRows.map((a) => ({
    name: a.name,
    distanceM: a.positionM,
    stopS: a.stopDurationS ?? undefined,
    legDurationS: imposed.get(a.positionM),
    providesLiquid: a.providesLiquid,
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

  const points = row.tracks.points;
  const totalM = row.tracks.distanceM;
  const timed = distributeTime(
    points,
    movingTimeS(settings.targetTimeS, stations, totalM),
    { climbIntensity: settings.climbIntensity, split: settings.paceSplit },
    fixedSpans(stations, totalM, imposed.get(totalM)),
  );
  const plan = nutritionPlan(
    timed,
    stations,
    runner,
    {
      carbsGH: settings.targetCarbsGH,
      fluidMlH: settings.targetFluidMlH,
      sodiumMgL: settings.targetSodiumMgL,
    },
    products,
  );

  await write(accessId, plan);
}

/**
 * Des durées entières dont la somme vaut encore le total.
 *
 * Arrondir chaque secteur isolément perd jusqu'à une demi-seconde par secteur
 * et casse l'invariant de somme du roadbook. On arrondit le **cumul** et on
 * prend les écarts : la somme se télescope et retombe sur le total arrondi.
 */
function integerDurations(plan: NutritionPlan): number[] {
  const out: number[] = [];
  let exact = 0;
  let placed = 0;

  for (const leg of plan.legs) {
    exact += leg.durationS;
    const cumulative = Math.round(exact);
    out.push(cumulative - placed);
    placed = cumulative;
  }

  return out;
}

async function write(accessId: string, plan: NutritionPlan): Promise<void> {
  const durations = integerDurations(plan);

  await db.transaction(async (tx) => {
    // Les avertissements globaux portent `leg_rank` à null : aucune cascade ne
    // les emporte, d'où le premier `delete`.
    await tx.delete(warnings).where(eq(warnings.planId, accessId));
    await tx.delete(legs).where(eq(legs.planId, accessId));

    await tx.insert(legs).values(
      plan.legs.map((leg, i) => ({
        planId: accessId,
        rank: i + 1,
        // Le dernier secteur s'achève à l'arrivée, qui n'est pas un ravito.
        endPositionM: leg.to === null ? null : Math.round(leg.endM),
        ascentM: Math.round(leg.ascentM),
        descentM: Math.round(leg.descentM),
        durationS: durations[i],
      })),
    );

    const rations = plan.legs.flatMap((leg, i) =>
      leg.servings.map((s) => ({
        planId: accessId,
        legRank: i + 1,
        productSnapshotId: s.product.id,
        quantity: s.units,
      })),
    );
    if (rations.length > 0) await tx.insert(servings).values(rations);

    const remplissages = plan.legs.flatMap((leg, i) =>
      leg.fills.map((f) => ({
        planId: accessId,
        legRank: i + 1,
        flaskRank: f.flaskIndex + 1,
        productSnapshotId: f.product?.id ?? null,
        volumeMl: Math.round(f.volumeMl),
      })),
    );
    if (remplissages.length > 0) await tx.insert(fill).values(remplissages);

    const remarques = plan.warnings.map((w) => {
      const { code, ...payload } = w as { code: string; legIndex?: number };

      return {
        planId: accessId,
        legRank: payload.legIndex === undefined ? null : payload.legIndex + 1,
        code: code as (typeof warnings.code.enumValues)[number],
        payload,
      };
    });
    if (remarques.length > 0) await tx.insert(warnings).values(remarques);

    await tx
      .update(plans)
      .set({ generatedAt: sql`now()`, lastSavedAt: sql`now()` })
      .where(eq(plans.accessId, accessId));
  });
}
