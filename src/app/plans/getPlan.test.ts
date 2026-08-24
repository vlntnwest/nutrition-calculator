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

test("les consignes de secteur font l'aller-retour, triées", async () => {
  const accessId = await createPlan({
    ...input,
    legOverrides: [
      { endPositionM: input.track.distanceM, durationS: 3600 },
      { endPositionM: 9800, durationS: 2700 },
    ],
  });
  written.push(accessId);

  expect((await getPlan(accessId))?.legOverrides).toEqual([
    { endPositionM: 9800, durationS: 2700 },
    { endPositionM: 28350, durationS: 3600 },
  ]);
});

test("ce qu'un ravito ne fournit pas se relit comme tel", async () => {
  // Un point d'eau, puis un passage sans assistance.
  const aidStations = [
    { ...input.aidStations[0], providesSolid: false },
    { ...input.aidStations[1], providesLiquid: false, providesSolid: false },
  ];
  const accessId = await createPlan({ ...input, aidStations });
  written.push(accessId);

  expect((await getPlan(accessId))?.aidStations).toEqual(aidStations);
});
