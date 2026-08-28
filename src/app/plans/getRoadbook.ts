import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fill } from "@/db/schema/fill";
import { flasks } from "@/db/schema/flasks";
import { legs } from "@/db/schema/legs";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { warnings } from "@/db/schema/warnings";
import { resolveTargets } from "./targets";

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

/** Ce que les rations apportent réellement. */
export type Supply = {
  carbsG: number;
  energyKcal: number;
  sodiumMg: number;
  fluidMl: number;
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
  supply: Supply;
  /** Les glucides visés sur ce secteur : la cible horaire fois sa durée. */
  needG: number;
  /**
   * Ce qu'il faut **boire** sur le secteur. À ne pas confondre avec les
   * volumes des flasques, qui partent pleines : on emporte souvent plus.
   */
  needFluidMl: number;
  /**
   * L'écart aux glucides visés, **signé** : un secteur peut passer sous son
   * besoin propre, la répartition se faisant sur toute la course.
   */
  marginG: number;
  warnings: { code: string; payload: unknown }[];
};

export type Roadbook = {
  legs: RoadbookLeg[];
  /** Le sac complet, et ce qu'il apporte. */
  total: Supply & {
    marginG: number;
    units: { name: string; brandName: string | null; quantity: number }[];
  };
  /** Ceux qui ne visent aucun secteur — ils portent `leg_rank` à null. */
  warnings: { code: string; payload: unknown }[];
};

const VIDE: Supply = { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 };

/**
 * Le côté calculé d'un plan, ou null s'il n'a jamais été calculé.
 *
 * `generated_at` fait foi : une mise à jour l'efface en même temps qu'elle
 * supprime les secteurs, il ne peut donc pas désigner un calcul périmé.
 *
 * L'apport se resomme depuis les rations plutôt que de se stocker : c'est la
 * somme des instantanés retenus, elle ne peut pas diverger de ce qui est
 * affiché juste au-dessus.
 */
export async function getRoadbook(accessId: string): Promise<Roadbook | null> {
  const [row] = await db
    .select()
    .from(plans)
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .where(eq(plans.accessId, accessId));

  const settings = row?.plan_settings;
  if (
    !row?.plans.generatedAt ||
    !settings?.targetTimeS ||
    settings.massKg === null
  ) {
    return null;
  }

  const [legRows, servingRows, fillRows, warningRows, flaskRows] =
    await Promise.all([
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
          carbsG: productSnapshots.carbsG,
          energyKcal: productSnapshots.energyKcal,
          sodiumMg: productSnapshots.sodiumMg,
          fluidMl: productSnapshots.fluidMl,
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
      db.select().from(flasks).where(eq(flasks.planId, accessId)),
    ]);

  const runner = {
    massKg: settings.massKg,
    flasks: flaskRows.map((f) => ({
      volumeMl: f.volumeMl,
      onlyWater: f.onlyWater,
    })),
  };
  const targets = resolveTargets(settings, runner, settings.targetTimeS);

  const byLeg = <T extends { legRank: number }>(rows: T[], rank: number) =>
    rows.filter((r) => r.legRank === rank);

  const legsOut = legRows.map((leg) => {
    const rations = byLeg(servingRows, leg.rank);
    const supply = rations.reduce(
      (s, r) => ({
        carbsG: s.carbsG + r.quantity * r.carbsG,
        energyKcal: s.energyKcal + r.quantity * r.energyKcal,
        sodiumMg: s.sodiumMg + r.quantity * r.sodiumMg,
        fluidMl: s.fluidMl + r.quantity * (r.fluidMl ?? 0),
      }),
      VIDE,
    );
    const needG = (targets.carbsGH * leg.durationS) / 3600;
    const needFluidMl = (targets.fluidMlH * leg.durationS) / 3600;

    return {
      rank: leg.rank,
      endPositionM: leg.endPositionM,
      ascentM: leg.ascentM,
      descentM: leg.descentM,
      durationS: leg.durationS,
      servings: rations.map((s) => ({
        name: s.name,
        brandName: s.brandName,
        quantity: s.quantity,
      })),
      fills: byLeg(fillRows, leg.rank).map((f) => ({
        flaskRank: f.flaskRank,
        product: f.product,
        volumeMl: f.volumeMl,
      })),
      supply,
      needG,
      needFluidMl,
      marginG: supply.carbsG - needG,
      warnings: warningRows
        .filter((w) => w.legRank === leg.rank)
        .map((w) => ({ code: w.code, payload: w.payload })),
    };
  });

  // Le sac : ce qu'on emporte au départ, tous secteurs confondus.
  const sac = new Map<string, { brandName: string | null; quantity: number }>();
  for (const r of servingRows) {
    const vu = sac.get(r.name);
    sac.set(r.name, {
      brandName: r.brandName,
      quantity: (vu?.quantity ?? 0) + r.quantity,
    });
  }

  return {
    legs: legsOut,
    total: {
      carbsG: legsOut.reduce((t, l) => t + l.supply.carbsG, 0),
      energyKcal: legsOut.reduce((t, l) => t + l.supply.energyKcal, 0),
      sodiumMg: legsOut.reduce((t, l) => t + l.supply.sodiumMg, 0),
      fluidMl: legsOut.reduce((t, l) => t + l.supply.fluidMl, 0),
      marginG: legsOut.reduce((t, l) => t + l.marginG, 0),
      units: [...sac].map(([name, v]) => ({ name, ...v })),
    },
    warnings: warningRows
      .filter((w) => w.legRank === null)
      .map((w) => ({ code: w.code, payload: w.payload })),
  };
}
