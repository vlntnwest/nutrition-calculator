import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { createPlan } from "./createPlan";
import { getRoadbook } from "./getRoadbook";
import { newPlan as input } from "./newPlan.fixture";
import { regeneratePlan } from "./regeneratePlan";
import { saveRoadbook } from "./saveRoadbook";

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

/**
 * Ce que le CLI affichait et que l'écran n'avait pas : l'apport réel du
 * secteur, et l'écart à ce qui était visé.
 */
test("chaque secteur porte son apport, et l'écart à la cible", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);
  const leg = roadbook?.legs[0];

  // L'apport est la somme des rations : rien d'autre ne peut le produire.
  expect(leg?.supply.carbsG).toBeGreaterThan(0);
  expect(leg?.supply.energyKcal).toBeGreaterThan(leg?.supply.carbsG ?? 0);

  // L'écart est signé, et vaut apport moins besoin — c'est sa définition.
  expect(leg?.marginG).toBeCloseTo(
    (leg?.supply.carbsG ?? 0) - (leg?.needG ?? 0),
    6,
  );

  // Le besoin suit la durée et la cible horaire, rien de plus.
  expect(leg?.needG).toBeCloseTo(
    (input.settings.targets.carbsGH * (leg?.durationS ?? 0)) / 3600,
    6,
  );
});

test("le total est la somme des secteurs", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);
  const legs = roadbook?.legs ?? [];

  expect(roadbook?.total.carbsG).toBeCloseTo(
    legs.reduce((t, l) => t + l.supply.carbsG, 0),
    6,
  );
  expect(roadbook?.total.marginG).toBeCloseTo(
    legs.reduce((t, l) => t + l.marginG, 0),
    6,
  );
  // Le sac : combien de chaque produit, tous secteurs confondus.
  expect(roadbook?.total.units.length).toBe(input.productCodes.length);
});

test("un plan sortant du calcul n'est pas marqué retouché", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  expect((await getRoadbook(accessId))?.edited).toBe(false);
});

test("le roadbook signale un plan retouché", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  const roadbook = await getRoadbook(accessId);
  if (!roadbook) throw new Error("Le plan devait être calculé");

  await saveRoadbook(accessId, {
    servings: roadbook.legs.map(() => []),
    fills: roadbook.legs.map(() => []),
  });

  expect((await getRoadbook(accessId))?.edited).toBe(true);
});

test("le roadbook porte de quoi retoucher", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);

  // Le catalogue du plan, ses contenants, et de quoi désigner chaque ration.
  expect(roadbook?.catalogue.length).toBe(input.productCodes.length);
  expect(roadbook?.flasks.map((f) => f.rank)).toEqual([1, 2]);
  for (const leg of roadbook?.legs ?? []) {
    for (const s of leg.servings) {
      expect(s.productSnapshotId).toMatch(/^[0-9a-f-]{36}$/);
      expect([1, 2]).toContain(s.divisibleBy);
    }
  }
});

test("un secteur qui part d'une borne sans eau n'ouvre pas de portée", async () => {
  // Le deuxième ravito ne donne pas d'eau : le secteur qui en repart boit ce
  // qu'il a chargé au premier, il n'y a rien à y verser.
  const accessId = await createPlan({
    ...input,
    aidStations: [
      input.aidStations[0],
      { ...input.aidStations[1], providesLiquid: false },
    ],
  });
  written.push(accessId);
  await regeneratePlan(accessId);

  const roadbook = await getRoadbook(accessId);

  expect(roadbook?.legs.map((l) => l.opensLiquidSpan)).toEqual([
    true,
    true,
    false,
  ]);
  // Et le calcul n'y a effectivement rien versé.
  expect(roadbook?.legs[2].fills).toEqual([]);
});
