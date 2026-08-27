import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fill } from "@/db/schema/fill";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { warnings } from "@/db/schema/warnings";

export type RoadbookServing = {
  name: string;
  brandName: string | null;
  quantity: number;
};

export type RoadbookFill = {
  flaskRank: number;
  /** Absent : de l'eau claire. */
  product: string | null;
  volumeMl: number;
};

export type RoadbookLeg = {
  rank: number;
  /** L'abscisse où le secteur s'achève. Nul pour l'arrivée. */
  endPositionM: number | null;
  ascentM: number;
  descentM: number;
  durationS: number;
  servings: RoadbookServing[];
  fills: RoadbookFill[];
  warnings: { code: string; payload: unknown }[];
};

export type Roadbook = {
  legs: RoadbookLeg[];
  /** Ceux qui ne visent aucun secteur — ils portent `leg_rank` à null. */
  warnings: { code: string; payload: unknown }[];
};

/**
 * Le côté calculé d'un plan, ou null s'il n'a jamais été calculé.
 *
 * `generated_at` fait foi : une mise à jour l'efface en même temps qu'elle
 * supprime les secteurs, il ne peut donc pas désigner un calcul périmé.
 */
export async function getRoadbook(accessId: string): Promise<Roadbook | null> {
  const [plan] = await db
    .select({ generatedAt: plans.generatedAt })
    .from(plans)
    .where(eq(plans.accessId, accessId));

  if (!plan?.generatedAt) return null;

  const [legRows, servingRows, fillRows, warningRows] = await Promise.all([
    db
      .select()
      .from(legs)
      .where(eq(legs.planId, accessId))
      .orderBy(asc(legs.rank)),
    db
      .select({
        legRank: servings.legRank,
        quantity: servings.quantity,
        name: productSnapshots.name,
        brandName: productSnapshots.brandName,
      })
      .from(servings)
      .innerJoin(
        productSnapshots,
        eq(servings.productSnapshotId, productSnapshots.id),
      )
      .where(eq(servings.planId, accessId))
      .orderBy(asc(servings.legRank), asc(productSnapshots.name)),
    db
      .select({
        legRank: fill.legRank,
        flaskRank: fill.flaskRank,
        volumeMl: fill.volumeMl,
        product: productSnapshots.name,
      })
      .from(fill)
      // `leftJoin` : un remplissage sans produit, c'est de l'eau claire.
      .leftJoin(
        productSnapshots,
        eq(fill.productSnapshotId, productSnapshots.id),
      )
      .where(eq(fill.planId, accessId))
      .orderBy(asc(fill.legRank), asc(fill.flaskRank)),
    db.select().from(warnings).where(eq(warnings.planId, accessId)),
  ]);

  const byLeg = <T extends { legRank: number }>(rows: T[], rank: number) =>
    rows.filter((r) => r.legRank === rank);

  return {
    legs: legRows.map((leg) => ({
      rank: leg.rank,
      endPositionM: leg.endPositionM,
      ascentM: leg.ascentM,
      descentM: leg.descentM,
      durationS: leg.durationS,
      servings: byLeg(servingRows, leg.rank).map((s) => ({
        name: s.name,
        brandName: s.brandName,
        quantity: s.quantity,
      })),
      fills: byLeg(fillRows, leg.rank).map((f) => ({
        flaskRank: f.flaskRank,
        product: f.product,
        volumeMl: f.volumeMl,
      })),
      warnings: warningRows
        .filter((w) => w.legRank === leg.rank)
        .map((w) => ({ code: w.code, payload: w.payload })),
    })),
    warnings: warningRows
      .filter((w) => w.legRank === null)
      .map((w) => ({ code: w.code, payload: w.payload })),
  };
}
