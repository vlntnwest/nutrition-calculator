import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { suggestedTargets } from "@/core/nutrition";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { createPlan } from "./createPlan";
import { getRoadbook } from "./getRoadbook";
import { newPlan as input } from "./newPlan.fixture";
import { regeneratePlan } from "./regeneratePlan";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

/**
 * Sans cibles saisies, le calcul prend celles que le noyau suggère — pas
 * `30 g/h`, qui produisait des plans tout en boisson.
 */
test("un plan sans cibles se calcule sur la suggestion du noyau", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, targets: undefined },
  });
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);
  const attendu = suggestedTargets(
    { massKg: 70, flasks: [] },
    input.settings.targetTimeS,
  );

  expect(attendu).toEqual({ carbsGH: 60, fluidMlH: 490, sodiumMgL: 600 });
  // 60 g/h sur 3 h 45 hors arrêts : ce que la suggestion réclame.
  const servi = roadbook?.legs
    .flatMap((l) => l.servings)
    .reduce((t, s) => t + s.quantity, 0);
  expect(servi).toBeGreaterThan(0);
  expect(roadbook?.warnings.some((w) => w.code === "carbs-above-target")).toBe(
    false,
  );
});
