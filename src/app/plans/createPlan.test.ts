import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { tracks } from "@/db/schema/tracks";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

test("écrire un plan rend son identifiant d'accès", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(rows).toHaveLength(1);
});

test("la trace est écrite avec le plan, points compris", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.planId, accessId));

  expect(track).toMatchObject({
    name: "Saverne Trail",
    distanceM: 28350,
    ascentM: 1314,
  });
  expect(track.points).toEqual(input.track.points);
});

test("les réglages sont écrits, les trois cibles à plat", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const [settings] = await db
    .select()
    .from(planSettings)
    .where(eq(planSettings.planId, accessId));

  expect(settings).toMatchObject({
    massKg: 70,
    targetTimeS: 13500,
    climbIntensity: 0.25,
    paceSplit: 0.05,
    raceDate: "2026-10-11",
    startTime: "08:00:00",
    targetCarbsGH: 60,
    targetFluidMlH: 490,
    targetSodiumMgL: 600,
  });
});

test("les flasques prennent leur rang dans l'ordre où elles arrivent", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(flasks)
    .where(eq(flasks.planId, accessId))
    .orderBy(flasks.rank);

  expect(rows).toMatchObject([
    { rank: 1, volumeMl: 500, onlyWater: false },
    { rank: 2, volumeMl: 500, onlyWater: true },
  ]);
});

test("un ravito porte son lieu et son arrêt, rien de plus", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(aidStations)
    .where(eq(aidStations.planId, accessId))
    .orderBy(aidStations.positionM);

  expect(rows).toMatchObject([
    { positionM: 9800, name: "Ravito Haberacker", stopDurationS: 300 },
    { positionM: 20800, name: "Ravito Ochsenstein", stopDurationS: 240 },
  ]);
});

test("une consigne se range sur l'abscisse où le secteur s'achève", async () => {
  const accessId = await createPlan({
    ...input,
    // Un ravito, puis l'arrivée : les deux sortes de borne.
    legOverrides: [
      { endPositionM: 20800, durationS: 4920 },
      { endPositionM: input.track.distanceM, durationS: 3600 },
    ],
  });
  written.push(accessId);

  const rows = await db
    .select()
    .from(legOverrides)
    .where(eq(legOverrides.planId, accessId))
    .orderBy(legOverrides.endPositionM);

  expect(rows).toMatchObject([
    { endPositionM: 20800, durationOverrideS: 4920 },
    { endPositionM: 28350, durationOverrideS: 3600 },
  ]);
});

test("une consigne posée hors d'une borne est refusée", async () => {
  // 15000 n'est ni un ravito ni l'arrivée : aucune clé étrangère ne peut le
  // dire, l'arrivée n'étant pas un ravito.
  await expect(
    createPlan({ ...input, legOverrides: [{ endPositionM: 15000 }] }),
  ).rejects.toThrow("Leg overrides at unknown boundaries: 15000");
});

test("un plan sans ravito ni flasque s'écrit quand même", async () => {
  const accessId = await createPlan({ ...input, flasks: [], aidStations: [] });
  written.push(accessId);

  expect(
    await db.select().from(flasks).where(eq(flasks.planId, accessId)),
  ).toHaveLength(0);
  expect(
    await db.select().from(aidStations).where(eq(aidStations.planId, accessId)),
  ).toHaveLength(0);
  expect(
    await db.select().from(tracks).where(eq(tracks.planId, accessId)),
  ).toHaveLength(1);
});

test("un réglage refusé par la base n'écrit aucune ligne", async () => {
  const before = await db.select().from(plans);

  await expect(
    createPlan({ ...input, settings: { ...input.settings, massKg: 0 } }),
  ).rejects.toThrow();

  expect(await db.select().from(plans)).toHaveLength(before.length);
});

test("un plan expire six mois après la course, pas après son enregistrement", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, raceDate: "2027-04-11" },
  });
  written.push(accessId);

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt.toISOString().slice(0, 10)).toBe("2027-10-11");
});

test("une course déjà passée garde six mois à compter de l'enregistrement", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, raceDate: "2020-01-01" },
  });
  written.push(accessId);

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt.getTime()).toBeGreaterThan(Date.now());
});

test("les produits retenus sont figés au moment du choix", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.planId, accessId))
    .orderBy(productSnapshots.name);

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    name: "Boisson isotonique ISO+",
    brandName: "Decathlon",
    formatLabel: "drink",
    carbsG: 33,
    fluidMl: 500,
    divisibleBy: 2,
    multiTransportable: false,
  });
});

test("un code produit inconnu refuse le plan entier", async () => {
  const before = await db.select().from(plans);

  await expect(
    createPlan({
      ...input,
      productCodes: ["naak-gel-ultra", "gel-imaginaire"],
    }),
  ).rejects.toThrow("gel-imaginaire");

  expect(await db.select().from(plans)).toHaveLength(before.length);
});
