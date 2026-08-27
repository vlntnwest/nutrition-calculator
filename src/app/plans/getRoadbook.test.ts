import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
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

test("un plan jamais calculé n'a pas de roadbook", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  expect(await getRoadbook(accessId)).toBeNull();
});

test("le roadbook rend les secteurs dans l'ordre, avec leurs rations", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);

  expect(roadbook?.legs.map((l) => l.endPositionM)).toEqual([
    9800,
    20800,
    null,
  ]);
  // La fixture n'a que cinq points : ces durées ne sont pas celles du vrai
  // saverne.gpx. Leur somme plus les arrêts fait le chrono visé, elle.
  expect(roadbook?.legs.map((l) => l.durationS)).toEqual([4556, 4970, 3434]);
  const roule = roadbook?.legs.reduce((sum, l) => sum + l.durationS, 0) ?? 0;
  expect(roule + 300 + 240).toBe(input.settings.targetTimeS);
  // Trois secteurs, chacun avec au moins de quoi manger.
  expect(roadbook?.legs.every((l) => l.servings.length > 0)).toBe(true);
  // Le premier remplissage part du départ : les deux flasques.
  expect(roadbook?.legs[0].fills.map((f) => f.flaskRank)).toEqual([1, 2]);
});

test("les avertissements globaux ne sont attachés à aucun secteur", async () => {
  // Sans produit, le noyau signale `no-carb-product`, qui ne vise aucun
  // secteur : `leg_rank` est nul, et aucune cascade ne l'emporte.
  const accessId = await createPlan({ ...input, productCodes: [] });
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);

  expect(roadbook?.warnings).toEqual([
    { code: "no-carb-product", payload: {} },
  ]);
  expect(roadbook?.legs.every((l) => l.warnings.length === 0)).toBe(true);
});
