import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { warnings } from "@/db/schema/warnings";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";
import { PlanError } from "./planError";
import { regeneratePlan } from "./regeneratePlan";
import { saveRoadbook } from "./saveRoadbook";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

/** Un plan calculé, avec de quoi désigner ses secteurs et ses produits. */
async function calcule() {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const [legRows, snapshots] = await Promise.all([
    db.select().from(legs).where(eq(legs.planId, accessId)).orderBy(legs.rank),
    db
      .select()
      .from(productSnapshots)
      .where(eq(productSnapshots.planId, accessId))
      .orderBy(productSnapshots.name),
  ]);

  return { accessId, legRows, snapshots };
}

/** Les remarques du plan, triées — c'est leur contenu qui compte. */
async function codes(accessId: string) {
  const rows = await db
    .select({ code: warnings.code, legRank: warnings.legRank })
    .from(warnings)
    .where(eq(warnings.planId, accessId));

  return rows.map((w) => `${w.legRank ?? "-"}:${w.code}`).sort();
}

/** Une consigne vide sur chaque secteur : on part sans rien. */
function rien(count: number) {
  return {
    servings: Array.from({ length: count }, () => []),
    fills: Array.from({ length: count }, () => []),
  };
}

test("les rations enregistrées remplacent celles du calcul", async () => {
  const { accessId, legRows, snapshots } = await calcule();

  await saveRoadbook(accessId, {
    ...rien(legRows.length),
    servings: legRows.map((_, i) =>
      i === 0 ? [{ productSnapshotId: snapshots[0].id, quantity: 2 }] : [],
    ),
  });

  const rows = await db
    .select()
    .from(servings)
    .where(eq(servings.planId, accessId));

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    legRank: 1,
    productSnapshotId: snapshots[0].id,
    quantity: 2,
  });
});

test("un enregistrement marque le plan comme retouché", async () => {
  const { accessId, legRows } = await calcule();

  await saveRoadbook(accessId, rien(legRows.length));

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.editedAt).not.toBeNull();
  expect(plan.generatedAt).not.toBeNull();
});

test("un recalcul efface la marque de retouche", async () => {
  const { accessId, legRows } = await calcule();
  await saveRoadbook(accessId, rien(legRows.length));

  await regeneratePlan(accessId);

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.editedAt).toBeNull();
});

test("une quantité hors grille se range sur le pas du produit", async () => {
  const { accessId, legRows, snapshots } = await calcule();
  const secable = snapshots.find((s) => s.divisibleBy === 2);
  if (!secable) throw new Error("La fixture n'a plus de produit sécable");

  await saveRoadbook(accessId, {
    ...rien(legRows.length),
    servings: legRows.map((_, i) =>
      i === 0 ? [{ productSnapshotId: secable.id, quantity: 1.4 }] : [],
    ),
  });

  const rows = await db
    .select()
    .from(servings)
    .where(eq(servings.planId, accessId));

  expect(rows[0].quantity).toBe(1.5);
});

test("les remarques se rejouent sur ce qui a été enregistré", async () => {
  const { accessId, legRows } = await calcule();
  const avant = await codes(accessId);

  // Un plan vidé de toutes ses rations ne couvre plus aucun besoin.
  await saveRoadbook(accessId, rien(legRows.length));

  expect(await codes(accessId)).not.toEqual(avant);
});

test("un instantané étranger au plan est refusé", async () => {
  const { accessId, legRows } = await calcule();

  await expect(
    saveRoadbook(accessId, {
      ...rien(legRows.length),
      servings: legRows.map((_, i) =>
        i === 0
          ? [
              {
                productSnapshotId: "00000000-0000-4000-8000-000000000000",
                quantity: 1,
              },
            ]
          : [],
      ),
    }),
  ).rejects.toThrow(PlanError);
});

test("une consigne qui ne couvre pas tous les secteurs est refusée", async () => {
  const { accessId } = await calcule();

  await expect(saveRoadbook(accessId, rien(1))).rejects.toThrow(PlanError);
});

test("une flasque inconnue est refusée", async () => {
  const { accessId, legRows } = await calcule();

  await expect(
    saveRoadbook(accessId, {
      ...rien(legRows.length),
      fills: legRows.map((_, i) =>
        i === 0
          ? [{ flaskRank: 9, productSnapshotId: null, volumeMl: 500 }]
          : [],
      ),
    }),
  ).rejects.toThrow(PlanError);
});
