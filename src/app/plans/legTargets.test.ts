import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { createPlan } from "./createPlan";
import { getPlan } from "./getPlan";
import { getRoadbook } from "./getRoadbook";
import { newPlan as input } from "./newPlan.fixture";
import { regeneratePlan } from "./regeneratePlan";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

test("une cible imposée se relit telle qu'elle a été écrite", async () => {
  const accessId = await createPlan({
    ...input,
    legOverrides: [
      { endPositionM: 9800, targets: { carbsGH: 90 } },
      { endPositionM: 20800, durationS: 4920, targets: { fluidMlH: 700 } },
      { endPositionM: input.track.distanceM, targets: { sodiumMgL: 800 } },
    ],
  });
  written.push(accessId);

  expect((await getPlan(accessId))?.legOverrides).toEqual([
    { endPositionM: 9800, durationS: undefined, targets: { carbsGH: 90 } },
    { endPositionM: 20800, durationS: 4920, targets: { fluidMlH: 700 } },
    { endPositionM: 28350, durationS: undefined, targets: { sodiumMgL: 800 } },
  ]);
});

test("une consigne sans cible ne fabrique pas de cibles vides", async () => {
  const accessId = await createPlan({
    ...input,
    legOverrides: [{ endPositionM: 20800, durationS: 4920 }],
  });
  written.push(accessId);

  expect((await getPlan(accessId))?.legOverrides[0].targets).toBeUndefined();
});

/**
 * Le point de la manœuvre : « ce secteur mérite plus ». La consigne est une
 * saisie, donc elle survit au recalcul — c'est ce qui la distingue d'une
 * ration ajoutée à la main sur le plan calculé.
 */
test("relever la cible d'un secteur y met davantage à manger", async () => {
  const nominal = await createPlan(input);
  written.push(nominal);
  await regeneratePlan(nominal);

  const force = await createPlan({
    ...input,
    legOverrides: [{ endPositionM: 9800, targets: { carbsGH: 90 } }],
  });
  written.push(force);
  await regeneratePlan(force);

  const avant = await getRoadbook(nominal);
  const apres = await getRoadbook(force);

  // Le premier secteur vise 90 g/h au lieu de 60 : son besoin monte de moitié.
  expect(apres?.legs[0].needG).toBeCloseTo(
    (avant?.legs[0].needG ?? 0) * 1.5,
    4,
  );
  // Les autres secteurs ne bougent pas.
  expect(apres?.legs[1].needG).toBeCloseTo(avant?.legs[1].needG ?? 0, 4);
  // Et il y a plus dans le sac.
  expect(apres?.total.carbsG).toBeGreaterThan(avant?.total.carbsG ?? 0);
});
