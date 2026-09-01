import { eq, sql } from "drizzle-orm";
import { nutritionPlan } from "@/core/nutrition";
import type { NutritionPlan } from "@/core/type";
import { db } from "@/db";
import { fill } from "@/db/schema/fill";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { servings } from "@/db/schema/servings";
import { warnings } from "@/db/schema/warnings";
import { planInputs } from "./planInputs";

/** Recalcule le plan et réécrit tout le côté droit du modèle. */
export async function regeneratePlan(accessId: string): Promise<void> {
  const { timed, stations, runner, targets, products, finishTargets } =
    await planInputs(accessId);

  const plan = nutritionPlan(timed, stations, runner, targets, products, {
    finishTargets,
  });

  await write(accessId, plan, { edited: false });
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

export async function write(
  accessId: string,
  plan: NutritionPlan,
  { edited }: { edited: boolean },
): Promise<void> {
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
      .set({
        generatedAt: sql`now()`,
        lastSavedAt: sql`now()`,
        editedAt: edited ? sql`now()` : null,
      })
      .where(eq(plans.accessId, accessId));
  });
}
