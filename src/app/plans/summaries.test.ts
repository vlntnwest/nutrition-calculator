import { eq, sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";
import { planSummaries } from "./summaries";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

async function plan() {
  const accessId = await createPlan(input);
  written.push(accessId);

  return accessId;
}

test("le relevé d'un plan porte sa course, ses mesures et ses dates", async () => {
  const accessId = await plan();

  const [summary] = await planSummaries([accessId]);

  expect(summary).toMatchObject({
    accessId,
    name: "Saverne Trail",
    distanceM: 28350,
    ascentM: 1314,
  });
  expect(summary.lastSavedAt).toBeInstanceOf(Date);
  expect((summary.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
});

/**
 * La liste de l'appareil garde des identifiants que la base n'a plus : un
 * plan périmé, un plan supprimé. L'écran les reconnaît à leur absence.
 */
test("un plan expiré ne ressort pas du relevé", async () => {
  const vivant = await plan();
  const perime = await plan();

  await db
    .update(plans)
    .set({ expiresAt: sql`now() - interval '1 day'` })
    .where(eq(plans.accessId, perime));

  const rendus = await planSummaries([vivant, perime]);

  expect(rendus.map((row) => row.accessId)).toEqual([vivant]);
});

test("un identifiant inconnu n'empêche pas les autres de sortir", async () => {
  const accessId = await plan();

  const rendus = await planSummaries([
    "00000000-0000-0000-0000-000000000000",
    accessId,
  ]);

  expect(rendus.map((row) => row.accessId)).toEqual([accessId]);
});

test("une liste vide ne descend pas jusqu'à la base", async () => {
  expect(await planSummaries([])).toEqual([]);
});
