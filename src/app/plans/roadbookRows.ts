import { asc, eq, getTableColumns } from "drizzle-orm";
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

export async function getRoadbookHead(accessId: string) {
  // Projection explicite : `tracks` porte `points` et `profile`, dont on ne
  // veut ici que la distance totale. Voir `getPlan`.
  const [row] = await db
    .select({
      generatedAt: plans.generatedAt,
      editedAt: plans.editedAt,
      distanceM: tracks.distanceM,
      settings: getTableColumns(planSettings),
    })
    .from(plans)
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .where(eq(plans.accessId, accessId));

  return row;
}

export async function getRoadbookRows(accessId: string) {
  const [
    legRows,
    servingRows,
    fillRows,
    warningRows,
    flaskRows,
    overrideRows,
    stationRows,
    catalogue,
  ] = await Promise.all([
    db
      .select()
      .from(legs)
      .where(eq(legs.planId, accessId))
      .orderBy(asc(legs.rank)),
    db
      .select({
        legRank: servings.legRank,
        quantity: servings.quantity,
        productSnapshotId: servings.productSnapshotId,
        divisibleBy: productSnapshots.divisibleBy,
        name: productSnapshots.name,
        brandName: productSnapshots.brandName,
        formatLabel: productSnapshots.formatLabel,
        carbsG: productSnapshots.carbsG,
        energyKcal: productSnapshots.energyKcal,
        sodiumMg: productSnapshots.sodiumMg,
        fluidMl: productSnapshots.fluidMl,
        weightG: productSnapshots.weightG,
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
        productSnapshotId: fill.productSnapshotId,
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
    db.select().from(legOverrides).where(eq(legOverrides.planId, accessId)),
    db.select().from(aidStations).where(eq(aidStations.planId, accessId)),
    db
      .select({
        id: productSnapshots.id,
        name: productSnapshots.name,
        brandName: productSnapshots.brandName,
        divisibleBy: productSnapshots.divisibleBy,
        formatLabel: productSnapshots.formatLabel,
        carbsG: productSnapshots.carbsG,
        energyKcal: productSnapshots.energyKcal,
        sodiumMg: productSnapshots.sodiumMg,
        fluidMl: productSnapshots.fluidMl,
        weightG: productSnapshots.weightG,
      })
      .from(productSnapshots)
      .where(eq(productSnapshots.planId, accessId))
      .orderBy(asc(productSnapshots.name)),
  ]);

  return {
    legRows,
    servingRows,
    fillRows,
    warningRows,
    flaskRows,
    overrideRows,
    stationRows,
    catalogue,
  };
}
