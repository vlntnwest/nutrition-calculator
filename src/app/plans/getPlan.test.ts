import { eq, sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { tracks } from "@/db/schema/tracks";
import { createPlan } from "./createPlan";
import { getPlan } from "./getPlan";
import { newPlan as input } from "./newPlan.fixture";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

test("un plan relu rend exactement ce qu'on avait écrit", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  // `productCodes` revient trié : c'est un ensemble, pas une suite.
  expect(await getPlan(accessId)).toEqual({
    ...input,
    productCodes: [...input.productCodes].sort(),
  });
});

/** On ne peut pas créer un plan déjà expiré : on fait passer le temps. */
async function expire(accessId: string) {
  await db
    .update(plans)
    .set({ expiresAt: sql`now() - interval '1 day'` })
    .where(eq(plans.accessId, accessId));
}

test("un plan expiré ne se relit pas", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await expire(accessId);

  expect(await getPlan(accessId)).toBeNull();
});

test("relire un plan expiré l'efface, lui et tout ce qui en dépend", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await expire(accessId);

  await getPlan(accessId);

  expect(
    await db.select().from(plans).where(eq(plans.accessId, accessId)),
  ).toHaveLength(0);
  expect(
    await db.select().from(tracks).where(eq(tracks.planId, accessId)),
  ).toHaveLength(0);
});

test("un identifiant inconnu rend null sans lever", async () => {
  expect(await getPlan("00000000-0000-4000-8000-000000000000")).toBeNull();
});

test("un plan en autonomie complète se relit aussi", async () => {
  const autonome = { ...input, flasks: [], aidStations: [] };
  const accessId = await createPlan(autonome);
  written.push(accessId);

  expect(await getPlan(accessId)).toEqual({
    ...autonome,
    productCodes: [...autonome.productCodes].sort(),
  });
});

test("la durée imposée au secteur d'arrivée fait l'aller-retour", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, finishDurationOverrideS: 3600 },
  });
  written.push(accessId);

  expect((await getPlan(accessId))?.settings.finishDurationOverrideS).toBe(
    3600,
  );
});
