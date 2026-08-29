import { asc, eq } from "drizzle-orm";
import { nutritionPlan } from "@/core/nutrition";
import { db } from "@/db";
import { legs } from "@/db/schema/legs";
import { PlanError } from "./planError";
import { planInputs } from "./planInputs";
import { write } from "./regeneratePlan";

/**
 * Un roadbook retouché, tel que l'écran le renvoie. Un tableau par secteur,
 * dans l'ordre des rangs — une ration retirée est une ligne absente, pas un
 * zéro.
 */
export type RoadbookEdit = {
  servings: { productSnapshotId: string; quantity: number }[][];
  fills: {
    flaskRank: number;
    productSnapshotId: string | null;
    volumeMl: number;
  }[][];
};

/**
 * Enregistre les retouches en rejouant le calcul avec elles pour consigne.
 *
 * Rien n'est refusé pour raison nutritionnelle : c'est le métier de
 * `warnings`, qui se rejoue ici même. Ce qui se refuse est une charge
 * incohérente, que la base rejetterait plus loin et plus obscurément. ADR 011.
 */
export async function saveRoadbook(
  accessId: string,
  edit: RoadbookEdit,
): Promise<void> {
  const { timed, stations, runner, targets, products, finishTargets } =
    await planInputs(accessId);

  const legRows = await db
    .select({ rank: legs.rank })
    .from(legs)
    .where(eq(legs.planId, accessId))
    .orderBy(asc(legs.rank));

  if (
    edit.servings.length !== legRows.length ||
    edit.fills.length !== legRows.length
  ) {
    throw new PlanError(
      `Roadbook edit covers ${edit.servings.length} legs, plan has ${legRows.length}`,
    );
  }

  const known = new Set(products.map((p) => p.id));
  const flaskRanks = new Set(runner.flasks.map((_, i) => i + 1));

  for (const leg of edit.servings) {
    for (const r of leg) {
      if (!known.has(r.productSnapshotId)) {
        throw new PlanError(`Unknown product snapshot: ${r.productSnapshotId}`);
      }
      if (!(r.quantity > 0)) {
        throw new PlanError(`Serving quantity must be positive: ${r.quantity}`);
      }
    }
  }

  for (const leg of edit.fills) {
    for (const f of leg) {
      if (!flaskRanks.has(f.flaskRank)) {
        throw new PlanError(`Unknown flask: ${f.flaskRank}`);
      }
      if (f.productSnapshotId !== null && !known.has(f.productSnapshotId)) {
        throw new PlanError(`Unknown product snapshot: ${f.productSnapshotId}`);
      }
      if (!(f.volumeMl > 0)) {
        throw new PlanError(`Fill volume must be positive: ${f.volumeMl}`);
      }
    }
  }

  const plan = nutritionPlan(timed, stations, runner, targets, products, {
    finishTargets,
    imposed: {
      servings: edit.servings.map((leg) =>
        leg.map((r) => ({ productId: r.productSnapshotId, units: r.quantity })),
      ),
      fills: edit.fills.map((leg) =>
        leg.map((f) => ({
          flaskIndex: f.flaskRank - 1,
          productId: f.productSnapshotId,
          volumeMl: f.volumeMl,
        })),
      ),
    },
  });

  await write(accessId, plan, { edited: true });
}
